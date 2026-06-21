using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Common;

/// <summary>
/// Kiểm soát quyền theo dòng dữ liệu. Hiện tại Admin và Teacher đều truy cập toàn bộ
/// (phân quyền admin-only qua policy trên Controller).
/// </summary>
public interface IClassAccessGuard
{
    /// <summary>Trả Success nếu được phép, NotFound nếu lớp không tồn tại.</summary>
    Task<Result> EnsureCanAccessClassAsync(Guid classId, CancellationToken ct = default);

    Task<bool> CanAccessClassAsync(Guid classId, CancellationToken ct = default);

    /// <summary>Admin/Teacher đều truy cập được — luôn Success.</summary>
    Task<Result> EnsureCanAccessStudentAsync(Guid studentId, CancellationToken ct = default);

    /// <summary>Scope Id để filter theo giáo viên; null = không scope (Admin/Teacher đều null hiện tại).</summary>
    Task<Guid?> GetTeacherScopeIdAsync(CancellationToken ct = default);

    bool IsAdmin { get; }
}
