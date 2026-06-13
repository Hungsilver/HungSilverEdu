using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Auth;

/// <summary>Hiện thực tại Infrastructure (cần ASP.NET Core Identity).</summary>
public interface IAuthService
{
    Task<Result<AuthTokens>> RegisterAsync(RegisterRequest request, CancellationToken ct = default);

    Task<Result<AuthTokens>> LoginAsync(LoginRequest request, CancellationToken ct = default);

    Task<Result<AuthTokens>> GoogleLoginAsync(GoogleLoginRequest request, CancellationToken ct = default);

    /// <summary>Refresh token rotation: token cũ bị thu hồi, phát hành cặp token mới.</summary>
    Task<Result<AuthTokens>> RefreshAsync(string refreshToken, CancellationToken ct = default);

    Task<Result> LogoutAsync(string refreshToken, CancellationToken ct = default);

    Task<Result<UserDto>> GetMeAsync(Guid userId, CancellationToken ct = default);
}
