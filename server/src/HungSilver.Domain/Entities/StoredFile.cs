using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Metadata file đã upload lên server (dùng chung cho tài liệu, avatar...).</summary>
public class StoredFile : BaseEntity
{
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string StoragePath { get; set; } = string.Empty;
    public Guid? UploadedByUserId { get; set; }

    /// <summary>SHA-256 (hex thường) của nội dung — dùng làm ETag + dedup + kiểm toàn vẹn.</summary>
    public string Sha256 { get; set; } = string.Empty;

    /// <summary>Mức truy cập khi tải xuống (mặc định: phải đăng nhập).</summary>
    public FileVisibility Visibility { get; set; } = FileVisibility.Authenticated;
}
