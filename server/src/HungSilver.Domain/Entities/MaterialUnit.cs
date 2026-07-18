using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>
/// Unit/Chương trong một Bộ tài liệu (vd "Unit 1: Family life", thanh "Review 1") — kiểu Sách Mềm.
/// Số hiển thị "Unit 1/2/3" không lưu mà derive từ vị trí SortOrder (đếm riêng theo Kind). Không khóa ngoại.
/// </summary>
public class MaterialUnit : BaseEntity
{
    /// <summary>Bộ tài liệu chứa unit (MaterialFolder.Id, không khóa ngoại). BẤT BIẾN sau khi tạo.</summary>
    public Guid FolderId { get; set; }

    /// <summary>Unit thường (có số + tên chủ đề) hay thanh Review xen kẽ.</summary>
    public MaterialUnitKind Kind { get; set; }

    /// <summary>Tên chủ đề: Unit bắt buộc (vd "Family life"); Review cho phép trống (hiển thị "Review 1").</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Vị trí trong bộ (gán max+1 khi tạo; đổi qua endpoint reorder).</summary>
    public int SortOrder { get; set; }
}
