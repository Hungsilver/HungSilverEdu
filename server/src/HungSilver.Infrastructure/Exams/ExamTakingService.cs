using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Application.Exams;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Exams;

/// <summary>
/// Luồng làm bài của học viên — server-authoritative: mốc bắt đầu + hết giờ tính ở server, tự chấm khi nộp.
/// Đáp án/giải thích KHÔNG lộ ra FE khi đang làm; chỉ trả khi xem lại (sau nộp).
/// </summary>
public sealed class ExamTakingService(AppDbContext context, ICurrentUser currentUser) : IExamTakingService
{
    /// <summary>Dung sai đồng hồ quanh mốc hết giờ — dùng chung với service nền chốt bài bỏ dở.</summary>
    public const int GraceSeconds = 20;

    public async Task<Result<List<PortalExamDto>>> GetMyExamsAsync(CancellationToken ct = default)
    {
        var studentResult = await GetStudentAsync(ct);
        if (studentResult.IsFailure) return Result.Failure<List<PortalExamDto>>(studentResult.Error);
        var student = studentResult.Value;

        var classIds = await StudentClassIdsAsync(student.Id, ct);
        if (classIds.Count == 0) return new List<PortalExamDto>();

        // Nạp attempt của HS trước: đề đã ĐÓNG nhưng HS có lượt làm vẫn phải hiện (giữ điểm + Xem lại);
        // chỉ ẩn đề đã đóng mà HS chưa từng làm.
        var myAttempts = await context.ExamAttempts.AsNoTracking()
            .Where(t => t.StudentId == student.Id).ToListAsync(ct);
        var attemptByAssignment = myAttempts.ToDictionary(t => t.ExamAssignmentId);
        var attemptAssignmentIds = myAttempts.Select(t => t.ExamAssignmentId).ToList();

        var assignments = await context.ExamAssignments.AsNoTracking()
            .Where(a => classIds.Contains(a.ClassId)
                && (a.Status == ExamAssignmentStatus.Open || attemptAssignmentIds.Contains(a.Id)))
            .OrderByDescending(a => a.OpenAt)
            .ToListAsync(ct);
        if (assignments.Count == 0) return new List<PortalExamDto>();

        var cIds = assignments.Select(a => a.ClassId).Distinct().ToList();
        var classNames = await context.Classes.Where(c => cIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Name, ct);

        var now = DateTime.Now;
        return assignments.Select(a =>
        {
            attemptByAssignment.TryGetValue(a.Id, out var at);
            // Khớp điều kiện StartAsync: đề GV đã đóng tay thì không còn "đang mở" dù chưa tới CloseAt.
            var isOpen = a.Status == ExamAssignmentStatus.Open
                && now >= a.OpenAt && (a.CloseAt is null || now <= a.CloseAt);
            return new PortalExamDto(a.Id, a.ExamId, a.ExamTitle ?? "Đề", classNames.GetValueOrDefault(a.ClassId, ""),
                a.Mode, a.DurationMinutes, a.OpenAt, a.CloseAt, isOpen, a.Status, at?.Status, at?.Id, at?.Score, a.TotalPoints);
        }).ToList();
    }

    public async Task<Result<PortalAttemptDto>> StartAsync(Guid assignmentId, CancellationToken ct = default)
    {
        var studentResult = await GetStudentAsync(ct);
        if (studentResult.IsFailure) return Result.Failure<PortalAttemptDto>(studentResult.Error);
        var student = studentResult.Value;

        var assignment = await context.ExamAssignments.FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
        if (assignment is null) return Result.Failure<PortalAttemptDto>(Error.NotFound("Exam.AssignmentNotFound", "Không tìm thấy đề được giao."));

        var classIds = await StudentClassIdsAsync(student.Id, ct);
        if (!classIds.Contains(assignment.ClassId))
            return Result.Failure<PortalAttemptDto>(Error.Forbidden("Exam.NotInClass", "Bạn không thuộc lớp được giao đề này."));

        var now = DateTime.Now;
        if (assignment.Status != ExamAssignmentStatus.Open)
            return Result.Failure<PortalAttemptDto>(Error.Validation("Exam.Closed", "Đề đã đóng."));
        if (now < assignment.OpenAt)
            return Result.Failure<PortalAttemptDto>(Error.Validation("Exam.NotOpen", "Chưa đến giờ làm bài."));
        if (assignment.CloseAt is not null && now > assignment.CloseAt)
            return Result.Failure<PortalAttemptDto>(Error.Validation("Exam.Expired", "Đã hết hạn làm bài."));

        var attempt = await context.ExamAttempts
            .FirstOrDefaultAsync(t => t.ExamAssignmentId == assignmentId && t.StudentId == student.Id, ct);
        if (attempt is not null && attempt.Status != ExamAttemptStatus.InProgress)
            return Result.Failure<PortalAttemptDto>(Error.Validation("Exam.AlreadySubmitted", "Bạn đã nộp bài này rồi."));

        if (attempt is null)
        {
            attempt = new ExamAttempt
            {
                ExamAssignmentId = assignmentId,
                StudentId = student.Id,
                Status = ExamAttemptStatus.InProgress,
                StartedAt = now
            };
            context.ExamAttempts.Add(attempt);
            try
            {
                await context.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                // Đua tạo attempt — nạp lại bản đã có.
                context.Entry(attempt).State = EntityState.Detached;
                attempt = await context.ExamAttempts
                    .FirstAsync(t => t.ExamAssignmentId == assignmentId && t.StudentId == student.Id, ct);
                if (attempt.Status != ExamAttemptStatus.InProgress)
                    return Result.Failure<PortalAttemptDto>(Error.Validation("Exam.AlreadySubmitted", "Bạn đã nộp bài này rồi."));
            }
        }

        // Không giới hạn giờ làm ⇒ ExpiresAt null (FE ẩn đồng hồ); mốc chốt là CloseAt (bắt buộc khi giao).
        DateTime? expiresAt = assignment.DurationMinutes is int d ? (attempt.StartedAt ?? now).AddMinutes(d) : null;

        var groups = await context.ExamQuestionGroups.AsNoTracking()
            .Where(g => g.ExamId == assignment.ExamId).OrderBy(g => g.OrderNo)
            .Select(g => new PortalGroupDto(g.Id, g.OrderNo, g.Section, g.ExerciseLabel, g.Instruction, g.Passage))
            .ToListAsync(ct);

        var questions = await context.ExamQuestions.AsNoTracking()
            .Where(q => q.ExamId == assignment.ExamId).OrderBy(q => q.OrderNo)
            .Select(q => new PortalQuestionDto(q.Id, q.GroupId, q.OrderNo, q.Type, q.Stem, q.OptionsJson, q.Points))
            .ToListAsync(ct);

        var saved = await context.ExamAttemptAnswers.AsNoTracking()
            .Where(x => x.AttemptId == attempt.Id)
            .Select(x => new PortalSavedAnswerDto(x.QuestionId, x.ResponseJson))
            .ToListAsync(ct);

        return new PortalAttemptDto(attempt.Id, assignmentId, assignment.ExamTitle ?? "Đề", assignment.DurationMinutes,
            expiresAt, assignment.CloseAt, assignment.TotalPoints, groups, questions, saved);
    }

    public async Task<Result> SaveAnswerAsync(Guid attemptId, SaveExamAnswerRequest request, CancellationToken ct = default)
    {
        var studentResult = await GetStudentAsync(ct);
        if (studentResult.IsFailure) return Result.Failure(studentResult.Error);
        var student = studentResult.Value;

        var attempt = await context.ExamAttempts.FirstOrDefaultAsync(t => t.Id == attemptId, ct);
        if (attempt is null || attempt.StudentId != student.Id)
            return Result.Failure(Error.NotFound("Exam.AttemptNotFound", "Không tìm thấy lượt làm bài."));
        if (attempt.Status != ExamAttemptStatus.InProgress)
            return Result.Failure(Error.Validation("Exam.AlreadySubmitted", "Bài đã nộp, không sửa được."));

        var assignment = await context.ExamAssignments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == attempt.ExamAssignmentId, ct);
        if (assignment is null) return Result.Failure(Error.NotFound("Exam.AssignmentNotFound", "Không tìm thấy đề."));
        var deadline = EffectiveDeadline(attempt, assignment);
        if (deadline is DateTime dl && DateTime.Now > dl.AddSeconds(GraceSeconds))
            return Result.Failure(Error.Validation("Exam.TimeUp", "Đã hết giờ làm bài."));
        // Bài không giới hạn không có "thời gian của mình" để bảo vệ ⇒ GV đóng là dừng nhận bài
        // (bài CÓ giờ giữ hành vi cũ: HS đang làm dở vẫn dùng hết giờ dù GV đã đóng).
        if (assignment.DurationMinutes is null && assignment.Status == ExamAssignmentStatus.Closed)
            return Result.Failure(Error.Validation("Exam.Closed", "Đề đã đóng."));

        var belongs = await context.ExamQuestions.AnyAsync(q => q.Id == request.QuestionId && q.ExamId == assignment.ExamId, ct);
        if (!belongs) return Result.Failure(Error.Validation("Exam.QuestionInvalid", "Câu hỏi không thuộc đề."));

        var answer = await context.ExamAttemptAnswers.FirstOrDefaultAsync(x => x.AttemptId == attemptId && x.QuestionId == request.QuestionId, ct);
        if (answer is null)
        {
            answer = new ExamAttemptAnswer { AttemptId = attemptId, QuestionId = request.QuestionId, ResponseJson = request.ResponseJson };
            context.ExamAttemptAnswers.Add(answer);
            try
            {
                await context.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                context.Entry(answer).State = EntityState.Detached;
                answer = await context.ExamAttemptAnswers.FirstAsync(x => x.AttemptId == attemptId && x.QuestionId == request.QuestionId, ct);
                answer.ResponseJson = request.ResponseJson;
                await context.SaveChangesAsync(ct);
            }
        }
        else
        {
            answer.ResponseJson = request.ResponseJson;
            await context.SaveChangesAsync(ct);
        }
        return Result.Success();
    }

    public async Task<Result<ExamAttemptResultDto>> SubmitAsync(Guid attemptId, CancellationToken ct = default)
    {
        var studentResult = await GetStudentAsync(ct);
        if (studentResult.IsFailure) return Result.Failure<ExamAttemptResultDto>(studentResult.Error);
        var student = studentResult.Value;

        var attempt = await context.ExamAttempts.FirstOrDefaultAsync(t => t.Id == attemptId, ct);
        if (attempt is null || attempt.StudentId != student.Id)
            return Result.Failure<ExamAttemptResultDto>(Error.NotFound("Exam.AttemptNotFound", "Không tìm thấy lượt làm bài."));

        var assignment = await context.ExamAssignments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == attempt.ExamAssignmentId, ct);
        if (assignment is null) return Result.Failure<ExamAttemptResultDto>(Error.NotFound("Exam.AssignmentNotFound", "Không tìm thấy đề."));

        // Idempotent: đã nộp ⇒ trả kết quả cũ.
        if (attempt.Status != ExamAttemptStatus.InProgress)
            return new ExamAttemptResultDto(attempt.Score ?? 0, assignment.TotalPoints, attempt.CorrectCount ?? 0, attempt.TotalCount ?? 0, attempt.Status);

        var deadline = EffectiveDeadline(attempt, assignment);
        var finalStatus = deadline is DateTime dl && DateTime.Now > dl.AddSeconds(GraceSeconds)
            ? ExamAttemptStatus.AutoSubmitted : ExamAttemptStatus.Submitted;
        try
        {
            await GradeAndFinalizeAsync(context, attempt, assignment, finalStatus, ct);
            await context.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Đua chốt bài (nộp kép / trùng lúc service nền chốt / autosave chen giữa) — nạp lại bản đã chốt.
            context.ChangeTracker.Clear();
            attempt = await context.ExamAttempts.AsNoTracking().FirstAsync(t => t.Id == attemptId, ct);
            if (attempt.Status == ExamAttemptStatus.InProgress)
                return Result.Failure<ExamAttemptResultDto>(Error.Validation("Exam.SubmitConflict", "Nộp bài bị trùng thao tác — vui lòng nộp lại."));
        }

        return new ExamAttemptResultDto(attempt.Score ?? 0, assignment.TotalPoints, attempt.CorrectCount ?? 0, attempt.TotalCount ?? 0, attempt.Status);
    }

    /// <summary>
    /// Lõi chấm + chốt 1 attempt (dùng chung: HS nộp bài và service nền chốt bài bỏ dở).
    /// Ghi IsCorrect/AwardedPoints từng câu, tạo bản ghi rỗng cho câu không trả lời,
    /// set Status/SubmittedAt/Score/CorrectCount/TotalCount. KHÔNG SaveChanges — caller lo.
    /// </summary>
    public static async Task GradeAndFinalizeAsync(AppDbContext context, ExamAttempt attempt,
        ExamAssignment assignment, ExamAttemptStatus finalStatus, CancellationToken ct = default)
    {
        var questions = await context.ExamQuestions.Where(q => q.ExamId == assignment.ExamId).ToListAsync(ct);
        var answerByQ = (await context.ExamAttemptAnswers.Where(x => x.AttemptId == attempt.Id).ToListAsync(ct))
            .ToDictionary(x => x.QuestionId);

        decimal score = 0;
        var correctCount = 0;
        foreach (var q in questions)
        {
            answerByQ.TryGetValue(q.Id, out var ans);
            var (correct, fraction) = ExamGrader.Grade(q.Type, q.AnswerJson, ans?.ResponseJson);
            var awarded = Math.Round(q.Points * fraction, 2);
            score += awarded;
            if (correct) correctCount++;

            if (ans is null)
                context.ExamAttemptAnswers.Add(new ExamAttemptAnswer { AttemptId = attempt.Id, QuestionId = q.Id, ResponseJson = null, IsCorrect = false, AwardedPoints = 0m });
            else
            {
                ans.IsCorrect = correct;
                ans.AwardedPoints = awarded;
            }
        }

        attempt.Status = finalStatus;
        attempt.SubmittedAt = DateTime.Now;
        attempt.Score = Math.Round(score, 2);
        attempt.CorrectCount = correctCount;
        attempt.TotalCount = questions.Count;
    }

    public async Task<Result<PortalReviewDto>> GetReviewAsync(Guid attemptId, CancellationToken ct = default)
    {
        var studentResult = await GetStudentAsync(ct);
        if (studentResult.IsFailure) return Result.Failure<PortalReviewDto>(studentResult.Error);
        var student = studentResult.Value;

        var attempt = await context.ExamAttempts.AsNoTracking().FirstOrDefaultAsync(t => t.Id == attemptId, ct);
        if (attempt is null || attempt.StudentId != student.Id)
            return Result.Failure<PortalReviewDto>(Error.NotFound("Exam.AttemptNotFound", "Không tìm thấy lượt làm bài."));
        if (attempt.Status == ExamAttemptStatus.InProgress)
            return Result.Failure<PortalReviewDto>(Error.Validation("Exam.NotSubmitted", "Chưa nộp bài nên chưa xem lại được."));

        var assignment = await context.ExamAssignments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == attempt.ExamAssignmentId, ct);
        if (assignment is null) return Result.Failure<PortalReviewDto>(Error.NotFound("Exam.AssignmentNotFound", "Không tìm thấy đề."));

        return await BuildReviewDtoAsync(context, attempt, assignment, ct);
    }

    /// <summary>
    /// Lõi dựng dữ liệu xem lại bài làm (đáp án đúng + giải thích + bài làm + điểm từng câu) —
    /// dùng chung: HS tự xem lại (GetReviewAsync) và GV xem bài làm học viên (ExamReportService).
    /// Caller tự lo guard quyền + trạng thái đã nộp.
    /// </summary>
    public static async Task<PortalReviewDto> BuildReviewDtoAsync(AppDbContext context, ExamAttempt attempt,
        ExamAssignment assignment, CancellationToken ct = default)
    {
        var groups = await context.ExamQuestionGroups.AsNoTracking()
            .Where(g => g.ExamId == assignment.ExamId).OrderBy(g => g.OrderNo)
            .Select(g => new PortalGroupDto(g.Id, g.OrderNo, g.Section, g.ExerciseLabel, g.Instruction, g.Passage))
            .ToListAsync(ct);

        var ansByQ = (await context.ExamAttemptAnswers.AsNoTracking().Where(x => x.AttemptId == attempt.Id).ToListAsync(ct))
            .ToDictionary(x => x.QuestionId);

        var questions = await context.ExamQuestions.AsNoTracking()
            .Where(q => q.ExamId == assignment.ExamId).OrderBy(q => q.OrderNo).ToListAsync(ct);

        var qDtos = questions.Select(q =>
        {
            ansByQ.TryGetValue(q.Id, out var a);
            return new PortalReviewQuestionDto(q.Id, q.GroupId, q.OrderNo, q.Type, q.Stem, q.OptionsJson,
                q.AnswerJson, q.Explanation, a?.ResponseJson, a?.IsCorrect, a?.AwardedPoints ?? 0m, q.Points);
        }).ToList();

        return new PortalReviewDto(assignment.ExamTitle ?? "Đề", attempt.Score ?? 0, assignment.TotalPoints,
            attempt.CorrectCount ?? 0, attempt.TotalCount ?? 0, attempt.Status, groups, qDtos);
    }

    // ----------------- Helpers -----------------

    /// <summary>
    /// Hạn chót hiệu dụng của một attempt: bài có giờ = StartedAt + DurationMinutes;
    /// bài không giới hạn = CloseAt (bắt buộc khi giao). Dùng chung với service nền chốt bài bỏ dở.
    /// </summary>
    internal static DateTime? EffectiveDeadline(ExamAttempt attempt, ExamAssignment assignment) =>
        assignment.DurationMinutes is int d
            ? (attempt.StartedAt ?? attempt.CreatedAt).AddMinutes(d)
            : assignment.CloseAt;

    private async Task<Result<Student>> GetStudentAsync(CancellationToken ct)
    {
        var userId = currentUser.UserId;
        if (userId is null) return Result.Failure<Student>(Error.Unauthorized("Portal.Unauthorized", "Chưa đăng nhập."));
        var student = await context.Students.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        return student is null
            ? Result.Failure<Student>(Error.NotFound("Portal.NotLinked", "Tài khoản chưa liên kết hồ sơ học sinh."))
            : student;
    }

    private async Task<List<Guid>> StudentClassIdsAsync(Guid studentId, CancellationToken ct) =>
        await context.Enrollments.AsNoTracking()
            .Where(e => e.StudentId == studentId && e.IsActive)
            .Select(e => e.ClassId).Distinct().ToListAsync(ct);
}
