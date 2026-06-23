using HungSilver.Application.Abstractions;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;

namespace HungSilver.Application.Common;

/// <summary>
/// Kiểm soát quyền theo dòng dữ liệu (row-level). Admin toàn quyền; Giáo viên chỉ thao tác trên
/// lớp mình phụ trách (TeacherProfile liên kết qua UserId) và học sinh đang học các lớp đó.
/// Mọi service nghiệp vụ gọi guard này để scope dữ liệu — đổi logic ở đây là đổi toàn hệ thống.
/// </summary>
public sealed class ClassAccessGuard(
    ICurrentUser currentUser,
    IRepository<ClassRoom> classes,
    IRepository<TeacherProfile> teacherProfiles,
    IRepository<Enrollment> enrollments) : IClassAccessGuard
{
    /// <summary>Sentinel scope cho GV không xác định/ chưa liên kết hồ sơ ⇒ không khớp lớp nào.</summary>
    private static readonly Guid NoScope = Guid.Empty;

    private bool _scopeResolved;
    private Guid? _scopeId;
    private List<Guid>? _ownedClassIds;

    public bool IsAdmin => currentUser.IsInRole(AppRoles.Admin);

    /// <summary>
    /// Admin → null (không scope, thấy tất cả). Giáo viên → Id hồ sơ GV liên kết; nếu chưa liên kết
    /// hoặc chưa đăng nhập → Guid.Empty (lọc ra 0 lớp — fail-safe).
    /// </summary>
    public async Task<Guid?> GetTeacherScopeIdAsync(CancellationToken ct = default)
    {
        if (_scopeResolved)
            return _scopeId;

        if (IsAdmin)
        {
            _scopeId = null;
        }
        else if (currentUser.UserId is Guid userId)
        {
            var profile = (await teacherProfiles.FindAsync(t => t.UserId == userId, ct)).FirstOrDefault();
            _scopeId = profile?.Id ?? NoScope;
        }
        else
        {
            _scopeId = NoScope;
        }

        _scopeResolved = true;
        return _scopeId;
    }

    public async Task<Result> EnsureCanAccessClassAsync(Guid classId, CancellationToken ct = default)
    {
        var cls = await classes.GetByIdAsync(classId, ct: ct);
        if (cls is null)
            return Result.Failure(Error.NotFound("Class.NotFound", "Không tìm thấy lớp học."));

        if (IsAdmin)
            return Result.Success();

        var scopeId = await GetTeacherScopeIdAsync(ct);
        return cls.TeacherProfileId == scopeId
            ? Result.Success()
            // Trả NotFound (không phải Forbidden) để không lộ sự tồn tại của lớp ngoài phạm vi.
            : Result.Failure(Error.NotFound("Class.NotFound", "Không tìm thấy lớp học."));
    }

    public async Task<bool> CanAccessClassAsync(Guid classId, CancellationToken ct = default)
    {
        var cls = await classes.GetByIdAsync(classId, ct: ct);
        if (cls is null)
            return false;
        if (IsAdmin)
            return true;
        var scopeId = await GetTeacherScopeIdAsync(ct);
        return cls.TeacherProfileId == scopeId;
    }

    public async Task<Result> EnsureCanAccessStudentAsync(Guid studentId, CancellationToken ct = default)
    {
        if (IsAdmin)
            return Result.Success();

        var ownedClassIds = await GetOwnedClassIdsAsync(ct);
        if (ownedClassIds.Count == 0)
            return Result.Failure(Error.NotFound("Student.NotFound", "Không tìm thấy học sinh."));

        var enrolled = await enrollments.AnyAsync(
            e => e.StudentId == studentId && e.IsActive && ownedClassIds.Contains(e.ClassId), ct);
        return enrolled
            ? Result.Success()
            : Result.Failure(Error.NotFound("Student.NotFound", "Không tìm thấy học sinh."));
    }

    private async Task<List<Guid>> GetOwnedClassIdsAsync(CancellationToken ct)
    {
        if (_ownedClassIds is not null)
            return _ownedClassIds;

        var scopeId = await GetTeacherScopeIdAsync(ct);
        _ownedClassIds = scopeId is null
            ? [] // Admin không dùng đường này; trả rỗng cho an toàn.
            : (await classes.FindAsync(c => c.TeacherProfileId == scopeId, ct)).Select(c => c.Id).ToList();
        return _ownedClassIds;
    }
}
