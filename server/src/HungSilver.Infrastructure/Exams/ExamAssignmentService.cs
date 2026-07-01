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

        if (request.ClassSessionId is not null)
        {
            var session = await context.ClassSessions.FirstOrDefaultAsync(s => s.Id == request.ClassSessionId, ct);
            if (session is null || session.ClassId != request.ClassId)
                return Result.Failure<ExamAssignmentDto>(Error.Validation("Exam.SessionClassMismatch", "Buổi học không thuộc lớp đã chọn."));
        }

        var assignment = new ExamAssignment
        {
            ExamId = exam.Id,
            ExamTitle = exam.Title,
            ClassId = request.ClassId,
            ClassSessionId = request.ClassSessionId,
            Mode = request.Mode,
            DurationMinutes = request.DurationMinutes is > 0 ? request.DurationMinutes!.Value : exam.DurationMinutes,
            // FE (nz-date-picker) gửi ISO UTC ⇒ đổi về giờ local (server TZ Asia/Ho_Chi_Minh) để so với DateTime.Now.
            OpenAt = ToLocal(request.OpenAt),
            CloseAt = request.CloseAt is DateTime c ? ToLocal(c) : null,
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
        var assignments = await context.ExamAssignments.AsNoTracking()
            .Where(a => a.ExamId == examId).OrderByDescending(a => a.CreatedAt).ToListAsync(ct);
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

        var list = assignments
            .Select(a => ToDto(a, classNames.GetValueOrDefault(a.ClassId, ""),
                sizes.GetValueOrDefault(a.ClassId, 0), submitted.GetValueOrDefault(a.Id, 0)))
            .ToList();
        return list;
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
