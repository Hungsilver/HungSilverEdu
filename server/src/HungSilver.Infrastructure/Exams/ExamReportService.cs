using HungSilver.Application.Common;
using HungSilver.Application.Exams;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Exams;

/// <summary>Tổng hợp báo cáo một lượt giao đề (chỉ đọc): per-student, TB lớp, phân bố điểm, item analysis.</summary>
public sealed class ExamReportService(AppDbContext context, IClassAccessGuard accessGuard) : IExamReportService
{
    public async Task<Result<ExamReportDto>> GetReportAsync(Guid assignmentId, CancellationToken ct = default)
    {
        var assignment = await context.ExamAssignments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
        if (assignment is null) return Result.Failure<ExamReportDto>(Error.NotFound("Exam.AssignmentNotFound", "Không tìm thấy lượt giao đề."));

        var access = await accessGuard.EnsureCanAccessClassAsync(assignment.ClassId, ct);
        if (access.IsFailure) return Result.Failure<ExamReportDto>(access.Error);

        var className = await context.Classes.Where(c => c.Id == assignment.ClassId).Select(c => c.Name).FirstOrDefaultAsync(ct) ?? "";

        // Học viên đang học trong lớp.
        var students = await (from e in context.Enrollments.AsNoTracking()
                              join s in context.Students.AsNoTracking() on e.StudentId equals s.Id
                              where e.ClassId == assignment.ClassId && e.IsActive
                              select new { s.Id, s.FullName })
            .Distinct().ToListAsync(ct);

        var attempts = await context.ExamAttempts.AsNoTracking()
            .Where(t => t.ExamAssignmentId == assignmentId).ToListAsync(ct);
        var attemptByStudent = attempts.GroupBy(t => t.StudentId).ToDictionary(g => g.Key, g => g.First());
        var submitted = attempts.Where(t => t.Status != ExamAttemptStatus.InProgress).ToList();

        var questions = await context.ExamQuestions.AsNoTracking()
            .Where(q => q.ExamId == assignment.ExamId).OrderBy(q => q.OrderNo)
            .Select(q => new { q.Id, q.OrderNo, q.SourceNumber, q.Type })
            .ToListAsync(ct);

        // Đáp án đã chấm của các lượt đã nộp (phục vụ item analysis). Contains([]) ⇒ EF trả rỗng an toàn.
        var submittedIds = submitted.Select(t => t.Id).ToList();
        var correctByQuestion = (await context.ExamAttemptAnswers.AsNoTracking()
                .Where(x => submittedIds.Contains(x.AttemptId) && x.IsCorrect == true)
                .Select(x => x.QuestionId)
                .ToListAsync(ct))
            .GroupBy(q => q)
            .ToDictionary(g => g.Key, g => g.Count());

        var submittedCount = submitted.Count;

        var itemStats = questions.Select(q =>
        {
            var correct = correctByQuestion.GetValueOrDefault(q.Id, 0);
            var pct = submittedCount == 0 ? 0d : Math.Round(correct * 100.0 / submittedCount, 1);
            return new ExamItemStatDto(q.Id, q.OrderNo, q.SourceNumber, q.Type, correct, submittedCount, pct);
        }).ToList();

        var distribution = BuildDistribution(submitted.Select(t => t.Score ?? 0m));

        decimal? average = submitted.Count == 0
            ? null
            : Math.Round(submitted.Average(t => t.Score ?? 0m), 2, MidpointRounding.AwayFromZero);

        var studentResults = students
            .Select(s =>
            {
                attemptByStudent.TryGetValue(s.Id, out var at);
                return new ExamStudentResultDto(s.Id, s.FullName, at?.Status, at?.Score, at?.SubmittedAt);
            })
            .OrderByDescending(r => r.Score ?? -1m)
            .ThenBy(r => r.FullName)
            .ToList();

        return new ExamReportDto(assignment.Id, assignment.ExamTitle ?? "Đề", className, assignment.TotalPoints,
            students.Count, submittedCount, average, distribution, itemStats, studentResults);
    }

    /// <summary>Chia điểm (/10) vào 5 khoảng: [0–2), [2–4), [4–6), [6–8), [8–10].</summary>
    private static List<ExamScoreBucketDto> BuildDistribution(IEnumerable<decimal> scores)
    {
        string[] labels = ["0–2", "2–4", "4–6", "6–8", "8–10"];
        var counts = new int[5];
        foreach (var s in scores)
        {
            var idx = (int)(s / 2);
            if (idx > 4) idx = 4;      // điểm 10 vào khoảng cuối
            if (idx < 0) idx = 0;
            counts[idx]++;
        }
        return labels.Select((l, i) => new ExamScoreBucketDto(l, counts[i])).ToList();
    }
}
