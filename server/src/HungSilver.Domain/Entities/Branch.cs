using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>Cơ sở / chi nhánh trung tâm (Đợt 8). Admin tự quản lý.</summary>
public class Branch : BaseEntity
{
    /// <summary>Mã viết tắt (vd "CS1", "CS2") — dùng làm prefix khi sinh mã HS.</summary>
    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Tiền tố sinh mã giáo viên cho cơ sở này (tự mang dấu phân tách của nó, vd "DongTho@").
    /// Trống → mặc định lấy theo tên cơ sở: "Đông Thọ" → "DongTho@" → mã "DongTho@TrangNTT0".
    /// </summary>
    public string? TeacherCodePrefix { get; set; }
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public int IndexOrder { get; set; }
    public bool IsActive { get; set; } = true;
}
