using HungSilver.Application.Abstractions;
using HungSilver.Application.Assignments;
using HungSilver.Application.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Assignments;

public sealed class AssignmentService(
    AppDbContext context,
    IClassAccessGuard accessGuard,
    ICurrentUser currentUser) : IAssignmentService
{
    private static readonly Error NotFoundError = Error.NotFound("Assignment.NotFound", "Không tìm thấy bài tập.");

    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

    public Task<Result<List<AssignmentDto>>> GetByClassAsync(Guid classId, CancellationToken ct = default) =>
        ListAsync(a => a.ClassId == classId, accessClassId: classId, ct);

    public async Task<Result<List<AssignmentDto>>> GetBySessionAsync(Guid sessionId, CancellationToken ct = default)
    {
        var session = await context.ClassSessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sessionId, ct);
        if (session is null)
            return Result.Failure<List<AssignmentDto>>(Error.NotFound("Session.NotFound", "Không tìm thấy buổi học."));
        return await ListAsync(a => a.ClassSessionId == sessionId, accessClassId: session.ClassId, ct);
    }

    private async Task<Result<List<AssignmentDto>>> ListAsync(
        System.Linq.Expressions.Expression<Func<Assignment, bool>> filter, Guid accessClassId, CancellationToken ct)
    {
        var access = await accessGuard.EnsureCanAccessClassAsync(accessClassId, ct);
        if (access.IsFailure)
            return Result.Failure<List<AssignmentDto>>(access.Error);

        var items = await context.Assignments.AsNoTracking().Where(filter)
            .OrderByDescending(a => a.CreatedAtUtc).ToListAsync(ct);
        if (items.Count == 0)
            return new List<AssignmentDto>();

        var ids = items.Select(a => a.Id).ToList();
        var classIds = items.Select(a => a.ClassId).Distinct().ToList();
        var materialIds = items.Where(a => a.MaterialId.HasValue).Select(a => a.MaterialId!.Value).Distinct().ToList();

        var totals = await context.Enrollments.AsNoTracking()
            .Where(e => classIds.Contains(e.ClassId) && e.IsActive)
            .GroupBy(e => e.ClassId).Select(g => new { ClassId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ClassId, x => x.Count, ct);

        var submitted = await context.Submissions.AsNoTracking()
            .Where(s => ids.Contains(s.AssignmentId) && s.SubmittedOn != null)
            .GroupBy(s => s.AssignmentId).Select(g => new { Id = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count, ct);

        var materialTitles = materialIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await context.LearningMaterials.AsNoTracking()
                .Where(m => materialIds.Contains(m.Id))
                .ToDictionaryAsync(m => m.Id, m => m.Title, ct);

        return items.Select(a => new AssignmentDto(
            a.Id, a.ClassId, a.ClassSessionId, a.MaterialId,
            a.MaterialId.HasValue ? materialTitles.GetValueOrDefault(a.MaterialId.Value) : null,
            a.Title, a.Instructions, a.DueDate,
            submitted.GetValueOrDefault(a.Id), totals.GetValueOrDefault(a.ClassId), a.CreatedAtUtc)).ToList();
    }

    public async Task<Result<AssignmentDto>> CreateAsync(CreateAssignmentRequest request, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessClassAsync(request.ClassId, ct);
        if (access.IsFailure)
            return Result.Failure<AssignmentDto>(access.Error);

        if (string.IsNullOrWhiteSpace(request.Title))
            return Result.Failure<AssignmentDto>(Error.Validation("Assignment.TitleRequired", "Tiêu đề bài tập bắt buộc."));

        var assignment = new Assignment
        {
            ClassId = request.ClassId,
            ClassSessionId = request.ClassSessionId,
            MaterialId = request.MaterialId,
            Title = request.Title.Trim(),
            Instructions = request.Instructions?.Trim(),
            DueDate = request.DueDate,
            AssignedByUserId = currentUser.UserId
        };

        context.Assignments.Add(assignment);
        await context.SaveChangesAsync(ct);

        var total = await context.Enrollments.CountAsync(e => e.ClassId == assignment.ClassId && e.IsActive, ct);
        string? materialTitle = assignment.MaterialId.HasValue
            ? (await context.LearningMaterials.AsNoTracking().FirstOrDefaultAsync(m => m.Id == assignment.MaterialId, ct))?.Title
            : null;

        return new AssignmentDto(assignment.Id, assignment.ClassId, assignment.ClassSessionId, assignment.MaterialId,
            materialTitle, assignment.Title, assignment.Instructions, assignment.DueDate, 0, total, assignment.CreatedAtUtc);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var assignment = await context.Assignments.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (assignment is null)
            return Result.Failure(NotFoundError);

        var access = await accessGuard.EnsureCanAccessClassAsync(assignment.ClassId, ct);
        if (access.IsFailure)
            return access;

        context.Assignments.Remove(assignment); // interceptor → soft delete
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result<List<SubmissionStatusDto>>> GetSubmissionsAsync(Guid assignmentId, CancellationToken ct = default)
    {
        var assignment = await context.Assignments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
        if (assignment is null)
            return Result.Failure<List<SubmissionStatusDto>>(NotFoundError);

        var access = await accessGuard.EnsureCanAccessClassAsync(assignment.ClassId, ct);
        if (access.IsFailure)
            return Result.Failure<List<SubmissionStatusDto>>(access.Error);

        var students = await (
            from e in context.Enrollments.AsNoTracking()
            join s in context.Students.AsNoTracking() on e.StudentId equals s.Id
            where e.ClassId == assignment.ClassId && e.IsActive
            orderby s.FullName
            select new { s.Id, s.FullName }).ToListAsync(ct);

        var subList = await context.Submissions.AsNoTracking()
            .Where(s => s.AssignmentId == assignmentId)
            .ToListAsync(ct);
        // GroupBy an toàn (phòng trùng (AssignmentId, StudentId) do race) → không ném khi build dict.
        var subs = subList.GroupBy(s => s.StudentId).ToDictionary(g => g.Key, g => g.First());

        var today = Today;
        return students.Select(s =>
        {
            subs.TryGetValue(s.Id, out var sub);
            return new SubmissionStatusDto(s.Id, s.FullName, DisplayStatus(sub, assignment.DueDate, today),
                sub?.SubmittedOn, sub?.Link, sub?.Note);
        }).ToList();
    }

    public async Task<Result> SetStatusAsync(Guid assignmentId, Guid studentId, SetSubmissionStatusRequest request, CancellationToken ct = default)
    {
        var assignment = await context.Assignments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
        if (assignment is null)
            return Result.Failure(NotFoundError);

        var access = await accessGuard.EnsureCanAccessClassAsync(assignment.ClassId, ct);
        if (access.IsFailure)
            return access;

        var sub = await context.Submissions.FirstOrDefaultAsync(s => s.AssignmentId == assignmentId && s.StudentId == studentId, ct);
        if (sub is null)
        {
            sub = new Submission { AssignmentId = assignmentId, StudentId = studentId };
            context.Submissions.Add(sub);
        }

        sub.Status = request.Status;
        if (request.Status is SubmissionStatus.Submitted or SubmissionStatus.Late)
            sub.SubmittedOn ??= Today;
        else
            sub.SubmittedOn = null;

        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    /// <summary>Trạng thái hiển thị: chưa nộp + quá hạn ⇒ Muộn; còn lại theo bản ghi nộp.</summary>
    private static SubmissionStatus DisplayStatus(Submission? sub, DateOnly? due, DateOnly today)
    {
        if (sub is not null && sub.Status != SubmissionStatus.NotSubmitted)
            return sub.Status;
        if (due is not null && today > due)
            return SubmissionStatus.Late;
        return SubmissionStatus.NotSubmitted;
    }
}
