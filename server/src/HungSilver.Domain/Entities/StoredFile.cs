using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>Metadata file đã upload lên server (dùng chung cho tài liệu, avatar...).</summary>
public class StoredFile : BaseEntity
{
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string StoragePath { get; set; } = string.Empty;
    public Guid? UploadedByUserId { get; set; }
}
