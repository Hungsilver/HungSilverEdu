using System.Security.Claims;
using HungSilver.Application.Auth;
using HungSilver.Domain.Common.Results;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

public sealed record AuthResponse(string AccessToken, DateTime AccessTokenExpiresAtUtc, UserDto User);

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService authService, IHostEnvironment environment) : ControllerBase
{
    private const string RefreshCookieName = "hs_refresh";

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken ct) =>
        ToAuthResponse(await authService.RegisterAsync(request, ct));

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken ct) =>
        ToAuthResponse(await authService.LoginAsync(request, ct));

    [HttpPost("google")]
    public async Task<ActionResult<AuthResponse>> GoogleLogin(GoogleLoginRequest request, CancellationToken ct) =>
        ToAuthResponse(await authService.GoogleLoginAsync(request, ct));

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh(CancellationToken ct)
    {
        var refreshToken = Request.Cookies[RefreshCookieName];
        return ToAuthResponse(await authService.RefreshAsync(refreshToken ?? string.Empty, ct));
    }

    [HttpPost("logout")]
    public async Task<ActionResult> Logout(CancellationToken ct)
    {
        var refreshToken = Request.Cookies[RefreshCookieName];
        await authService.LogoutAsync(refreshToken ?? string.Empty, ct);

        Response.Cookies.Delete(RefreshCookieName, BuildCookieOptions(DateTime.UtcNow));
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> Me(CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue("sub"), out var userId))
            return Error.Unauthorized("Auth.InvalidToken", "Token không hợp lệ.").ToProblemResult();

        return (await authService.GetMeAsync(userId, ct)).ToActionResult();
    }

    /// <summary>
    /// Access token trả trong body; refresh token KHÔNG trả trong body mà set vào
    /// HttpOnly cookie (path /api/auth) — JS phía client không đọc được, chống XSS.
    /// </summary>
    private ActionResult ToAuthResponse(Result<AuthTokens> result)
    {
        if (result.IsFailure)
            return result.Error.ToProblemResult();

        var tokens = result.Value;
        Response.Cookies.Append(RefreshCookieName, tokens.RefreshToken,
            BuildCookieOptions(tokens.RefreshTokenExpiresAtUtc));

        return Ok(new AuthResponse(tokens.AccessToken, tokens.AccessTokenExpiresAtUtc, tokens.User));
    }

    private CookieOptions BuildCookieOptions(DateTime expiresAtUtc) => new()
    {
        HttpOnly = true,
        Secure = !environment.IsDevelopment(),
        SameSite = SameSiteMode.Lax,
        Path = "/api/auth",
        Expires = expiresAtUtc
    };
}
