using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>Cơ sở / chi nhánh trung tâm (Đợt 8). Admin tự quản lý.</summary>
public class Branch : BaseEntity
{
    /// <summary>Mã viết tắt (vd "CS1", "CS2") — dùng làm prefix khi sinh mã HS.</summary>
    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public int IndexOrder { get; set; }
    public bool IsActive { get; set; } = true;
}
