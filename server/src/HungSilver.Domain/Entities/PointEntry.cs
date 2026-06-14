using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Sổ cái điểm thưởng/phạt (Module 6 - Phần 4,5). Số dư = SUM reward − SUM penalty − SUM đã quy đổi.</summary>
public class PointEntry : BaseEntity
{
    public Guid StudentId { get; set; }
    public Guid? ClassSessionId { get; set; }
    public PointType Type { get; set; }

    /// <summary>Độ lớn điểm (luôn dương); dấu suy ra từ Type.</summary>
    public int Points { get; set; }

    public string Reason { get; set; } = string.Empty;
    public Guid? AwardedByUserId { get; set; }
}
