using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Lý do cộng hoặc trừ điểm thưởng — cấu hình bởi Admin, hiển thị dạng nút bấm nhanh ở trang buổi học.</summary>
public class PointReason : BaseEntity
{
    public string Label { get; set; } = string.Empty;
    public int Points { get; set; } = 1;
    public PointReasonType Type { get; set; }
    public int IndexOrder { get; set; }
    public bool IsActive { get; set; } = true;
}
