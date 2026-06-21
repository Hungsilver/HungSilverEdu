using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>Môn học (Đợt 7) — gốc phân loại lớp: Môn → Khối → Lớp. Admin tự quản lý.</summary>
public class Subject : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}
