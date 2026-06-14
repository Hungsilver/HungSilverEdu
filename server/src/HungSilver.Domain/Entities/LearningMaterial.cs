using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Tài liệu học tập theo lớp (Module 11). Lưu link ngoài hoặc tham chiếu file đã upload.</summary>
public class LearningMaterial : BaseEntity
{
    public Guid ClassId { get; set; }
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
