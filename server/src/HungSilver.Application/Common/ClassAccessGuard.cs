using HungSilver.Application.Abstractions;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;

namespace HungSilver.Application.Common;

public sealed class ClassAccessGuard(
    ICurrentUser currentUser,
    IRepository<ClassRoom> classes,
    IRepository<Enrollment> enrollments) : IClassAccessGuard
{
    private static readonly Error StudentForbidden =
        Error.Forbidden("Student.Forbidden", "Bạn không có quyền truy cập học sinh này.");

    public bool IsAdmin => currentUser.IsInRole(AppRoles.Admin);

    public Guid? TeacherScopeId => IsAdmin ? null : currentUser.UserId;

    public async Task<Result> EnsureCanAccessClassAsync(Guid classId, CancellationToken ct = default)
    {
        if (IsAdmin)
            return Result.Success();

        var cls = await classes.GetByIdAsync(classId, ct: ct);
        if (cls is null)
            return Result.Failure(Error.NotFound("Class.NotFound", "Không tìm thấy lớp học."));

        return cls.TeacherId == currentUser.UserId
            ? Result.Success()
            : Result.Failure(Error.Forbidden("Class.Forbidden", "Bạn không có quyền truy cập lớp học này."));
    }

    public async Task<bool> CanAccessClassAsync(Guid classId, CancellationToken ct = default)
    {
        if (IsAdmin)
            return true;

        var cls = await classes.GetByIdAsync(classId, ct: ct);
        return cls is not null && cls.TeacherId == currentUser.UserId;
    }

    public async Task<Result> EnsureCanAccessStudentAsync(Guid studentId, CancellationToken ct = default)
    {
        if (IsAdmin)
            return Result.Success();

        var studentEnrollments = await enrollments.FindAsync(e => e.StudentId == studentId && e.IsActive, ct);
        var classIds = studentEnrollments.Select(e => e.ClassId).Distinct().ToList();
        if (classIds.Count == 0)
            return Result.Failure(StudentForbidden);

        var ok = await classes.AnyAsync(c => classIds.Contains(c.Id) && c.TeacherId == currentUser.UserId, ct);
        return ok ? Result.Success() : Result.Failure(StudentForbidden);
    }
}
