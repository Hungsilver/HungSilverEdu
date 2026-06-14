using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Lượt quy đổi điểm thưởng (Module 6).</summary>
public class RewardRedemption : BaseEntity
{
    public Guid StudentId { get; set; }
    public RewardTier Tier { get; set; }
    public int PointsSpent { get; set; }
    public DateOnly RedeemedOn { get; set; }
    public string? Note { get; set; }
}
