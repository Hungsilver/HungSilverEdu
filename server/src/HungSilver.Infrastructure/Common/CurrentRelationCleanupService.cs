using HungSilver.Application.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Common;

public sealed class CurrentRelationCleanupService(AppDbContext context) : ICurrentRelationCleanupService
{
    public async Task SoftDeleteActiveEnrollmentsForStudentAsync(Guid studentId, CancellationToken ct = default)
    {
        var enrollments = await context.Enrollments
            .Where(e => e.StudentId == studentId && e.IsActive)
            .ToListAsync(ct);

        SoftDeleteEnrollments(enrollments);
    }

    public async Task SoftDeleteInvalidActiveEnrollmentsForClassAsync(Guid classId, CancellationToken ct = default)
    {
        var enrollments = await context.Enrollments
            .Where(e => e.ClassId == classId && e.IsActive)
            .ToListAsync(ct);
        if (enrollments.Count == 0)
            return;

        var studentIds = enrollments.Select(e => e.StudentId).Distinct().ToList();
        var liveStudentIds = await context.Students
            .Where(s => studentIds.Contains(s.Id))
            .Select(s => s.Id)
            .ToHashSetAsync(ct);

        var invalid = enrollments.Where(e => !liveStudentIds.Contains(e.StudentId)).ToList();
        SoftDeleteEnrollments(invalid);
    }

    public async Task SoftDeleteCurrentClassRelationsAsync(Guid classId, CancellationToken ct = default)
    {
        var slots = await context.ClassScheduleSlots
            .Where(s => s.ClassId == classId)
            .ToListAsync(ct);
        context.ClassScheduleSlots.RemoveRange(slots);

        var materials = await context.LearningMaterials
            .Where(m => m.ClassId == classId)
            .ToListAsync(ct);
        context.LearningMaterials.RemoveRange(materials);

        var assignments = await context.Assignments
            .Where(a => a.ClassId == classId)
            .ToListAsync(ct);
        context.Assignments.RemoveRange(assignments);

        var today = DateOnly.FromDateTime(DateTime.Now);
        var futureSessions = await context.ClassSessions
            .Where(s => s.ClassId == classId
                        && s.SessionDate >= today
                        && s.Status == SessionStatus.Scheduled)
            .ToListAsync(ct);
        context.ClassSessions.RemoveRange(futureSessions);
    }

    public Task<bool> HasValidActiveEnrollmentsForClassAsync(Guid classId, CancellationToken ct = default) =>
        (from e in context.Enrollments.AsNoTracking()
         join s in context.Students.AsNoTracking() on e.StudentId equals s.Id
         where e.ClassId == classId && e.IsActive
         select e.Id).AnyAsync(ct);

    public async Task<Dictionary<Guid, int>> LoadValidClassSizesAsync(IEnumerable<Guid> classIds, CancellationToken ct = default)
    {
        var ids = classIds.Distinct().ToList();
        if (ids.Count == 0)
            return [];

        return await (
                from e in context.Enrollments.AsNoTracking()
                join s in context.Students.AsNoTracking() on e.StudentId equals s.Id
                where ids.Contains(e.ClassId) && e.IsActive
                group e by e.ClassId into g
                select new { ClassId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ClassId, x => x.Count, ct);
    }

    public async Task<HashSet<Guid>> LoadValidActiveStudentIdsByClassesAsync(IEnumerable<Guid> classIds, CancellationToken ct = default)
    {
        var ids = classIds.Distinct().ToList();
        if (ids.Count == 0)
            return [];

        return await (
                from e in context.Enrollments.AsNoTracking()
                join s in context.Students.AsNoTracking() on e.StudentId equals s.Id
                where ids.Contains(e.ClassId) && e.IsActive
                select e.StudentId)
            .Distinct()
            .ToHashSetAsync(ct);
    }

    public async Task<Result> EnsureMaterialCategoryNotInUseAsync(Guid categoryId, CancellationToken ct = default)
    {
        var inUse = await context.LearningMaterials
            .AnyAsync(m => m.CategoryId == categoryId, ct);

        return inUse
            ? Result.Failure(Error.Conflict("MaterialCategory.InUse", "Không thể xóa danh mục khi vẫn còn học liệu đang sử dụng."))
            : Result.Success();
    }

    public async Task NullAssignmentsForMaterialAsync(Guid materialId, CancellationToken ct = default)
    {
        var assignments = await context.Assignments
            .Where(a => a.MaterialId == materialId)
            .ToListAsync(ct);

        foreach (var assignment in assignments)
            assignment.MaterialId = null;
    }

    public async Task UnlinkUserRelationsAsync(Guid userId, CancellationToken ct = default)
    {
        var students = await context.Students
            .Where(s => s.UserId == userId)
            .ToListAsync(ct);
        foreach (var student in students)
            student.UserId = null;

        var teachers = await context.TeacherProfiles
            .Where(t => t.UserId == userId)
            .ToListAsync(ct);
        foreach (var teacher in teachers)
            teacher.UserId = null;
    }

    private void SoftDeleteEnrollments(IEnumerable<Domain.Entities.Enrollment> enrollments)
    {
        var today = DateOnly.FromDateTime(DateTime.Now);
        foreach (var enrollment in enrollments)
        {
            enrollment.IsActive = false;
            enrollment.WithdrawnOn ??= today;
            context.Enrollments.Remove(enrollment);
        }
    }
}
