using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>
/// Refresh token rotation: chỉ lưu SHA-256 hash của token, token gốc nằm trong HttpOnly cookie phía client.
/// </summary>
public class RefreshToken : BaseEntity
{
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? ReplacedByTokenHash { get; set; }

    public bool IsActive => RevokedAt is null && DateTime.Now < ExpiresAt;
}
