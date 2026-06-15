using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>Danh mục/khối học liệu do admin tự định nghĩa — gốc của thư viện học liệu (Đợt 3).</summary>
public class MaterialCategory : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}
