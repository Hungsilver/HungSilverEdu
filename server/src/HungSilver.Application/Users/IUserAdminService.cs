using HungSilver.Application.Common.Models;
using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Users;

/// <summary>Chức năng quản trị user (chỉ Admin). Hiện thực tại Infrastructure.</summary>
public interface IUserAdminService
{
    /// <summary>Liệt kê user, bao gồm cả user đã xóa mềm để admin có thể khôi phục.</summary>
    Task<Result<PagedResult<UserListItemDto>>> GetUsersAsync(PagedRequest request, CancellationToken ct = default);

    /// <summary>Admin tạo tài khoản mới (Admin hoặc Giáo viên).</summary>
    Task<Result<UserListItemDto>> CreateUserAsync(CreateUserRequest request, CancellationToken ct = default);

    Task<Result> AssignRolesAsync(Guid userId, AssignRolesRequest request, CancellationToken ct = default);

    Task<Result> SoftDeleteAsync(Guid userId, CancellationToken ct = default);

    Task<Result> RestoreAsync(Guid userId, CancellationToken ct = default);
}
