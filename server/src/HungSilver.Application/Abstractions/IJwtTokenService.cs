namespace HungSilver.Application.Abstractions;

public sealed record AccessTokenResult(string Token, DateTime ExpiresAt);

public interface IJwtTokenService
{
    /// <param name="mustChangePassword">
    /// true ⇒ gắn claim <c>mcp</c> vào token; middleware sẽ chặn mọi API (403) tới khi người dùng đổi mật khẩu.
    /// </param>
    AccessTokenResult CreateAccessToken(
        Guid userId, string email, string? fullName, IEnumerable<string> roles, bool mustChangePassword = false);

    /// <summary>Sinh refresh token ngẫu nhiên (raw — trả cho client qua HttpOnly cookie).</summary>
    string CreateRefreshToken();

    /// <summary>SHA-256 hash để lưu refresh token vào database.</summary>
    string HashToken(string token);
}
