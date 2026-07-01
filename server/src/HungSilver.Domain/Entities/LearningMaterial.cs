using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Tài liệu học tập theo lớp (Module 11). Lưu link ngoài hoặc tham chiếu file đã upload.</summary>
public class LearningMaterial : BaseEntity
{
    /// <summary>Học liệu gắn 1 lớp; null = học liệu thư viện chung (phân loại theo <see cref="CategoryId"/>).</summary>
    public Guid? ClassId { get; set; }

    /// <summary>Danh mục/khối học liệu (thư viện). Tùy chọn.</summary>
    public Guid? CategoryId { get; set; }

    /// <summary>Khối lớp gắn học liệu (danh sách chuẩn ở Settings, vd "Khối 6"). Tùy chọn (Đợt 7).</summary>
    public string? GradeBand { get; set; }

    /// <summary>Môn học (trục quản lý mới — Guid + snapshot tên, không khóa ngoại). Tùy chọn.</summary>
    public Guid? SubjectId { get; set; }
    public string? SubjectName { get; set; }

    public string Title { get; set; } = string.Empty;
    public MaterialType Type { get; set; }
    public MaterialSource Source { get; set; } = MaterialSource.ExternalUrl;

    /// <summary>Dùng khi Source = ExternalUrl.</summary>
    public string? Url { get; set; }

    /// <summary>Dùng khi Source = ServerFile (tham chiếu StoredFile.Id).</summary>
    public Guid? StoredFileId { get; set; }

    public string? Description { get; set; }
    public Guid? UploadedByUserId { get; set; }
}
