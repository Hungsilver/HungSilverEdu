namespace HungSilver.Application.Users;

public sealed record UserListItemDto(
    Guid Id,
    string Email,
    string? FullName,
    IReadOnlyList<string> Roles,
    bool IsDeleted,
    DateTime CreatedAtUtc);

public sealed record AssignRolesRequest(IReadOnlyList<string> Roles);
