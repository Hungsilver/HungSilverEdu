namespace HungSilver.Domain.Enums;

/// <summary>Loại điểm: thưởng (Phần 4) hoặc phạt (Phần 5).</summary>
public enum PointType
{
    Reward = 0,   // Điểm thưởng
    Penalty = 1   // Điểm phạt
}

/// <summary>Mốc quy đổi điểm thưởng (giá trị = số điểm cần).</summary>
public enum RewardTier
{
    SmallGift = 50,       // Quà nhỏ
    FreeMaterials = 100,  // Miễn phí tài liệu
    FeeDiscount = 150     // Giảm học phí
}
