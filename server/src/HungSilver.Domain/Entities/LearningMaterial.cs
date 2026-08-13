using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Tài liệu trong Kho tài liệu. Lưu link ngoài hoặc tham chiếu file đã upload.</summary>
public class LearningMaterial : BaseEntity
{
    /// <summary>Mã tài liệu tự sinh dạng TL0001, duy nhất (kể cả bản ghi đã xóa mềm — không tái cấp).</summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>Bộ tài liệu chứa tài liệu này (MaterialFolder.Id, không khóa ngoại). Null = "Tài liệu chung".</summary>
    public Guid? FolderId { get; set; }

    /// <summary>Unit chứa tài liệu (MaterialUnit.Id, không khóa ngoại). Chỉ có nghĩa khi có FolderId; null = chưa thuộc Unit.</summary>
    public Guid? UnitId { get; set; }

    /// <summary>Khối (snapshot tên từ danh mục Khối GradeCategory). Tùy chọn.</summary>
    public string? GradeBand { get; set; }

    /// <summary>Môn học (Guid + snapshot tên, không khóa ngoại).</summary>
    public Guid? SubjectId { get; set; }
    public string? SubjectName { get; set; }

    public string Title { get; set; } = string.Empty;
    public MaterialSource Source { get; set; } = MaterialSource.ExternalUrl;

    /// <summary>Dùng khi Source = ExternalUrl.</summary>
    public string? Url { get; set; }

    /// <summary>Dùng khi Source = ServerFile (tham chiếu StoredFile.Id).</summary>
    public Guid? StoredFileId { get; set; }

    /// <summary>Ảnh bìa hiển thị trên card (tham chiếu StoredFile.Id, Visibility = Public, không khóa ngoại). Tùy chọn.</summary>
    public Guid? CoverFileId { get; set; }

    public string? Description { get; set; }
}
