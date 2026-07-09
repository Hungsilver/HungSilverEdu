namespace HungSilver.Application.Users;

public sealed record UserListItemDto(
    Guid Id,
    string UserName,
    string Email,
    string? FullName,
    string? PhoneNumber,
    IReadOnlyList<string> Roles,
    bool IsDeleted,
    bool IsLocked,
    string? LinkedType,
    DateTime CreatedAt);

public sealed record AssignRolesRequest(IReadOnlyList<string> Roles);

/// <summary>Admin tạo tài khoản Admin/Giáo viên. Email tùy chọn (suy ra từ username nếu bỏ trống).</summary>
public sealed record CreateUserRequest(
    string UserName,
    string? Email,
    string Password,
    string? FullName,
    string Role);

/// <summary>
/// Admin sửa thông tin cơ bản của tài khoản. Tên đăng nhập chỉ đổi được với tài khoản
/// KHÔNG liên kết hồ sơ HS/GV (giữ bất biến "tên đăng nhập = mã hồ sơ").
/// </summary>
public sealed record UpdateUserRequest(
    string? UserName,
    string? Email,
    string? FullName,
    string? PhoneNumber);

/// <summary>
/// Admin đổi/đặt lại mật khẩu tài khoản. Bỏ trống Password ⇒ về mật khẩu mặc định của hệ thống.
/// MustChangePassword = true ⇒ buộc đổi mật khẩu ở lần đăng nhập kế tiếp.
/// </summary>
public sealed record AdminResetPasswordRequest(
    string? Password,
    bool MustChangePassword = true);
