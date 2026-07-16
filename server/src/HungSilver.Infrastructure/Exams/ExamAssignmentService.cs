using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Application.Exams;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Exams;

/// <summary>GV giao đề đã phát hành cho lớp (mirror AssignmentService): access-guard lớp, validate buổi cùng lớp.</summary>
public sealed class ExamAssignmentService(
    AppDbContext context,
    IClassAccessGuard accessGuard,
    ICurrentUser currentUser) : IExamAssignmentService
{
    public async Task<Result<ExamAssignmentDto>> AssignAsync(Guid examId, AssignExamRequest request, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessClassAsync(request.ClassId, ct);
        if (access.IsFailure) return Result.Failure<ExamAssignmentDto>(access.Error);

        var exam = await context.Exams.FirstOrDefaultAsync(e => e.Id == examId, ct);
        if (exam is null) return Result.Failure<ExamAssignmentDto>(Error.NotFound("Exam.NotFound", "Không tìm thấy đề."));
        if (exam.Status != ExamStatus.Published)
            return Result.Failure<ExamAssignmentDto>(Error.Validation("Exam.NotPublished", "Chỉ giao được đề đã phát hành."));

        // Đề Published vẫn có thể về 0 câu (xóa câu chỉ bị khóa khi đề ĐÃ giao) — chặn giao đề rỗng.
        if (!await context.ExamQuestions.AnyAsync(q => q.ExamId == examId, ct))
            return Result.Failure<ExamAssignmentDto>(Error.Validation("Exam.NoQuestions", "Đề chưa có câu hỏi nào — không thể giao."));

        // Chặn giao trùng: còn lượt giao đang mở (chưa đóng, chưa quá hạn nộp) cùng đề + lớp.
        // Lượt Open nhưng đã quá hạn thì coi như xong — cho giao lại mà không bắt đóng tay.
        var now = DateTime.Now;
        var hasOpen = await context.ExamAssignments.AnyAsync(
            a => a.ExamId == examId && a.ClassId == request.ClassId
                 && a.Status == ExamAssignmentStatus.Open
                 && (a.CloseAt == null || a.CloseAt > now), ct);
        if (hasOpen)
            return Result.Failure<ExamAssignmentDto>(Error.Validation("Exam.AlreadyAssigned",
                "Đề này đã được giao cho lớp và đang mở — đóng lượt cũ trước khi giao lại."));

        if (request.ClassSessionId is not null)
        {
            var session = await context.ClassSessions.FirstOrDefaultAsync(s => s.Id == request.ClassSessionId, ct);
            if (session is null || session.ClassId != request.ClassId)
                return Result.Failure<ExamAssignmentDto>(Error.Validation("Exam.SessionClassMismatch", "Buổi học không thuộc lớp đã chọn."));
        }

        if (request.NoTimeLimit && request.Mode != ExamDeliveryMode.Homework)
            return Result.Failure<ExamAssignmentDto>(Error.Validation("Exam.NoTimeLimitOnlyHomework", "Chỉ bài về nhà mới được không giới hạn thời gian làm bài."));
        // Không giới hạn giờ làm ⇒ hạn nộp là mốc chốt bài duy nhất, bắt buộc phải có (tránh attempt treo "Đang làm" vĩnh viễn).
        if (request.NoTimeLimit && request.CloseAt is null)
            return Result.Failure<ExamAssignmentDto>(Error.Validation("Exam.CloseAtRequired", "Bài không giới hạn thời gian bắt buộc phải có hạn nộp."));

        // FE (nz-date-picker) gửi ISO UTC ⇒ đổi về giờ local (server TZ Asia/Ho_Chi_Minh) để so với DateTime.Now.
        var openAt = ToLocal(request.OpenAt);
        DateTime? closeAt = request.CloseAt is DateTime c ? ToLocal(c) : null;
        if (closeAt is DateTime cl && cl <= openAt)
            return Result.Failure<ExamAssignmentDto>(Error.Validation("Exam.CloseBeforeOpen", "Hạn nộp phải sau thời điểm mở."));

        var assignment = new ExamAssignment
        {
            ExamId = exam.Id,
            ExamTitle = exam.Title,
            ClassId = request.ClassId,
            ClassSessionId = request.ClassSessionId,
            Mode = request.Mode,
            DurationMinutes = request.NoTimeLimit ? null : (request.DurationMinutes is > 0 ? request.DurationMinutes!.Value : exam.DurationMinutes),
            OpenAt = openAt,
            CloseAt = closeAt,
            TotalPoints = exam.TotalPoints,
            Status = ExamAssignmentStatus.Open,
            AssignedByUserId = currentUser.UserId
        };
        context.ExamAssignments.Add(assignment);
        await context.SaveChangesAsync(ct);

        var className = await context.Classes.Where(c => c.Id == request.ClassId).Select(c => c.Name).FirstOrDefaultAsync(ct);
        return ToDto(assignment, className ?? "", 0, 0);
    }

    public async Task<Result<List<ExamAssignmentDto>>> ListByExamAsync(Guid examId, CancellationToken ct = default)
    {
        var query = context.ExamAssignments.AsNoTracking().Where(a => a.ExamId == examId);

        // Đề là kho dùng chung: GV chỉ thấy lượt giao cho lớp mình phụ trách, Admin thấy tất cả.
        if (!accessGuard.IsAdmin)
        {
            var ownedClassIds = await accessGuard.GetOwnedClassIdsAsync(ct);
            query = query.Where(a => ownedClassIds.Contains(a.ClassId));
        }

        var assignments = await query.OrderByDescending(a => a.CreatedAt).ToListAsync(ct);
        return await ToDtosAsync(assignments, ct);
    }

    public async Task<Result<List<ExamAssignmentDto>>> ListBySessionAsync(Guid sessionId, CancellationToken ct = default)
    {
        var session = await context.ClassSessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sessionId, ct);
        if (session is null) return Result.Failure<List<ExamAssignmentDto>>(Error.NotFound("Session.NotFound", "Không tìm thấy buổi học."));

        var access = await accessGuard.EnsureCanAccessClassAsync(session.ClassId, ct);
        if (access.IsFailure) return Result.Failure<List<ExamAssignmentDto>>(access.Error);

        // Chỉ lượt giao gắn đúng buổi này — đề giao cho lớp không gắn buổi xem ở trang chi tiết đề.
        var assignments = await context.ExamAssignments.AsNoTracking()
            .Where(a => a.ClassSessionId == sessionId).OrderByDescending(a => a.CreatedAt).ToListAsync(ct);
        return await ToDtosAsync(assignments, ct);
    }

    public async Task<Result<List<ExamAssignmentDto>>> ListByClassAsync(Guid classId, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessClassAsync(classId, ct);
        if (access.IsFailure) return Result.Failure<List<ExamAssignmentDto>>(access.Error);

        var assignments = await context.ExamAssignments.AsNoTracking()
            .Where(a => a.ClassId == classId).OrderByDescending(a => a.CreatedAt).ToListAsync(ct);
        return await ToDtosAsync(assignments, ct);
    }

    /// <summary>Dựng DTO kèm tên lớp + sĩ số + số đã nộp (dùng chung ListByExam/ListBySession/ListByClass).</summary>
    private async Task<List<ExamAssignmentDto>> ToDtosAsync(List<ExamAssignment> assignments, CancellationToken ct)
    {
        if (assignments.Count == 0) return new List<ExamAssignmentDto>();

        var classIds = assignments.Select(a => a.ClassId).Distinct().ToList();
        var classNames = await context.Classes.Where(c => classIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Name, ct);

        var assignmentIds = assignments.Select(a => a.Id).ToList();
        var attempts = await context.ExamAttempts.AsNoTracking()
            .Where(t => assignmentIds.Contains(t.ExamAssignmentId))
            .Select(t => new { t.ExamAssignmentId, t.Status })
            .ToListAsync(ct);
        var submitted = attempts.Where(t => t.Status != ExamAttemptStatus.InProgress)
            .GroupBy(t => t.ExamAssignmentId).ToDictionary(g => g.Key, g => g.Count());

        var sizes = await LoadClassSizesAsync(classIds, ct);

        return assignments
            .Select(a => ToDto(a, classNames.GetValueOrDefault(a.ClassId, ""),
                sizes.GetValueOrDefault(a.ClassId, 0), submitted.GetValueOrDefault(a.Id, 0)))
            .ToList();
    }

    public async Task<Result> CloseAsync(Guid assignmentId, CancellationToken ct = default)
    {
        var assignment = await context.ExamAssignments.FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
        if (assignment is null) return Result.Failure(Error.NotFound("Exam.AssignmentNotFound", "Không tìm thấy lượt giao đề."));

        var access = await accessGuard.EnsureCanAccessClassAsync(assignment.ClassId, ct);
        if (access.IsFailure) return access;

        assignment.Status = ExamAssignmentStatus.Closed;
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    private static DateTime ToLocal(DateTime dt) => dt.Kind == DateTimeKind.Utc ? dt.ToLocalTime() : dt;

    private async Task<Dictionary<Guid, int>> LoadClassSizesAsync(List<Guid> classIds, CancellationToken ct) =>
        await (from e in context.Enrollments.AsNoTracking()
               join s in context.Students.AsNoTracking() on e.StudentId equals s.Id
               where classIds.Contains(e.ClassId) && e.IsActive
               group e by e.ClassId into g
               select new { ClassId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ClassId, x => x.Count, ct);

    private static ExamAssignmentDto ToDto(ExamAssignment a, string className, int totalStudents, int submitted) =>
        new(a.Id, a.ExamId, a.ExamTitle, a.ClassId, className, a.ClassSessionId, a.Mode, a.DurationMinutes,
            a.OpenAt, a.CloseAt, a.Status, totalStudents, submitted, a.CreatedAt);
}
