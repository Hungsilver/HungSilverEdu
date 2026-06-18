namespace HungSilver.Application.Abstractions;

public sealed record AccessTokenResult(string Token, DateTime ExpiresAt);

public interface IJwtTokenService
{
    AccessTokenResult CreateAccessToken(Guid userId, string email, string? fullName, IEnumerable<string> roles);

    /// <summary>Sinh refresh token ngẫu nhiên (raw — trả cho client qua HttpOnly cookie).</summary>
    string CreateRefreshToken();

    /// <summary>SHA-256 hash để lưu refresh token vào database.</summary>
    string HashToken(string token);
}
