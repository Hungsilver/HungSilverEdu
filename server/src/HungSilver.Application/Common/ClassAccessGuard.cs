using HungSilver.Application.Abstractions;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;

namespace HungSilver.Application.Common;

public sealed class ClassAccessGuard(
    ICurrentUser currentUser,
    IRepository<ClassRoom> classes) : IClassAccessGuard
{
    public bool IsAdmin => currentUser.IsInRole(AppRoles.Admin);

    public Task<Guid?> GetTeacherScopeIdAsync(CancellationToken ct = default)
        => Task.FromResult<Guid?>(null);

    public async Task<Result> EnsureCanAccessClassAsync(Guid classId, CancellationToken ct = default)
    {
        var cls = await classes.GetByIdAsync(classId, ct: ct);
        return cls is null
            ? Result.Failure(Error.NotFound("Class.NotFound", "Không tìm thấy lớp học."))
            : Result.Success();
    }

    public async Task<bool> CanAccessClassAsync(Guid classId, CancellationToken ct = default)
    {
        var cls = await classes.GetByIdAsync(classId, ct: ct);
        return cls is not null;
    }

    public Task<Result> EnsureCanAccessStudentAsync(Guid studentId, CancellationToken ct = default)
        => Task.FromResult(Result.Success());
}
