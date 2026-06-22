using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>Danh mục khối lớp. Không dùng FK; lớp học snapshot tên khối tại thời điểm lưu.</summary>
public class GradeCategory : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int IndexOrder { get; set; }
    public bool IsActive { get; set; } = true;
}
