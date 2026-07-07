using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>
/// Bộ tài liệu trong Kho tài liệu (vd "Tiếng Anh 10") — gom tài liệu theo Môn học.
/// GV/Admin tạo tự do trong từng môn. Không khóa ngoại.
/// </summary>
public class MaterialFolder : BaseEntity
{
    /// <summary>Môn học (Guid + snapshot tên, không khóa ngoại). BẤT BIẾN sau khi tạo — muốn đổi môn thì tạo bộ mới.</summary>
    public Guid SubjectId { get; set; }
    public string SubjectName { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    /// <summary>Khối (snapshot tên từ danh mục Khối GradeCategory). Tùy chọn — tài liệu trong bộ kế thừa giá trị này.</summary>
    public string? GradeBand { get; set; }

    /// <summary>Ảnh bìa 16:9 hiển thị trên card (StoredFile.Id, Visibility = Public, không khóa ngoại). Tùy chọn.</summary>
    public Guid? CoverFileId { get; set; }

    public string? Description { get; set; }
}
