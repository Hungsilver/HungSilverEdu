namespace HungSilver.Application.Abstractions;

/// <summary>Truy vấn thông tin user/role từ Identity cho các service nghiệp vụ (không có FK).</summary>
public interface IUserDirectory
{
    Task<bool> ExistsAsync(Guid userId, CancellationToken ct = default);

    Task<bool> IsInRoleAsync(Guid userId, string role, CancellationToken ct = default);

    /// <summary>Tên hiển thị (FullName hoặc Email) theo từng userId.</summary>
    Task<Dictionary<Guid, string>> GetDisplayNamesAsync(IEnumerable<Guid> userIds, CancellationToken ct = default);

    /// <summary>Thông tin tài khoản (tên đăng nhập, đang khóa, bắt buộc đổi mật khẩu) theo userId — cho hiển thị trạng thái.</summary>
    Task<Dictionary<Guid, AccountInfo>> GetAccountInfosAsync(IEnumerable<Guid> userIds, CancellationToken ct = default);

    Task<List<UserSummary>> GetUsersInRoleAsync(string role, CancellationToken ct = default);

    Task<IReadOnlyList<string>> GetRolesAsync(Guid userId, CancellationToken ct = default);

    /// <summary>Id của role theo tên (dùng cho cấu hình scope = Role).</summary>
    Task<Guid?> GetRoleIdAsync(string role, CancellationToken ct = default);
}

public sealed record UserSummary(Guid Id, string Email, string? FullName);

public sealed record AccountInfo(string UserName, bool IsLocked, bool MustChangePassword);
