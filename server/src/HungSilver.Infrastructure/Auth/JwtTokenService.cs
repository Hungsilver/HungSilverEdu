using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using HungSilver.Application.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace HungSilver.Infrastructure.Auth;

public sealed class JwtTokenService(IOptions<JwtOptions> options) : IJwtTokenService
{
    private readonly JwtOptions _options = options.Value;

    /// <summary>Tên claim đánh dấu "phải đổi mật khẩu" — middleware đọc để chặn API.</summary>
    public const string MustChangePasswordClaim = "mcp";

    public AccessTokenResult CreateAccessToken(
        Guid userId, string email, string? fullName, IEnumerable<string> roles, bool mustChangePassword = false)
    {
        var expiresAt = DateTime.Now.AddMinutes(_options.AccessTokenMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new(JwtRegisteredClaimNames.Email, email),
            new(JwtRegisteredClaimNames.Name, fullName ?? email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };
        claims.AddRange(roles.Select(role => new Claim("role", role)));
        if (mustChangePassword)
            claims.Add(new Claim(MustChangePasswordClaim, "1"));

        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            Expires = expiresAt,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Secret)),
                SecurityAlgorithms.HmacSha256)
        };

        var token = new JsonWebTokenHandler().CreateToken(descriptor);
        return new AccessTokenResult(token, expiresAt);
    }

    public string CreateRefreshToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

    public string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
