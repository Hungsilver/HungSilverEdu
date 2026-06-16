namespace HungSilver.Application.Users;

public sealed record UserListItemDto(
    Guid Id,
    string UserName,
    string Email,
    string? FullName,
    IReadOnlyList<string> Roles,
    bool IsDeleted,
    DateTime CreatedAtUtc);

public sealed record AssignRolesRequest(IReadOnlyList<string> Roles);

/// <summary>Admin tạo tài khoản Admin/Giáo viên. Email tùy chọn (suy ra từ username nếu bỏ trống).</summary>
public sealed record CreateUserRequest(
    string UserName,
    string? Email,
    string Password,
    string? FullName,
    string Role);
