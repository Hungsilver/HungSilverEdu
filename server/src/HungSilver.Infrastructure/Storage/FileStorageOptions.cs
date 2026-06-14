namespace HungSilver.Infrastructure.Storage;

public sealed class FileStorageOptions
{
    public const string SectionName = "FileStorage";

    /// <summary>Thư mục gốc lưu file (tương đối với app hoặc tuyệt đối).</summary>
    public string RootPath { get; set; } = "uploads";

    /// <summary>Kích thước tối đa mỗi file (mặc định 20MB).</summary>
    public long MaxSizeBytes { get; set; } = 20 * 1024 * 1024;

    /// <summary>Danh sách content-type cho phép; rỗng = cho phép tất cả.</summary>
    public string[] AllowedContentTypes { get; set; } = [];
}
