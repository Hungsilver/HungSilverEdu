namespace HungSilver.Application.Auth;

public sealed record RegisterRequest(string Email, string Password, string FullName);

public sealed record LoginRequest(string Email, string Password);

public sealed record GoogleLoginRequest(string IdToken);

public sealed record UserDto(
    Guid Id,
    string Email,
    string? FullName,
    string? AvatarUrl,
    IReadOnlyList<string> Roles);

/// <summary>
/// Kết quả đăng nhập đầy đủ ở tầng Application. Controller chỉ trả AccessToken trong body,
/// còn RefreshToken được set vào HttpOnly cookie.
/// </summary>
public sealed record AuthTokens(
    string AccessToken,
    DateTime AccessTokenExpiresAtUtc,
    string RefreshToken,
    DateTime RefreshTokenExpiresAtUtc,
    UserDto User);
