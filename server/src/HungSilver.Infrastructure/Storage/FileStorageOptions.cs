namespace HungSilver.Infrastructure.Storage;

public sealed class FileStorageOptions
{
    public const string SectionName = "FileStorage";

    /// <summary>Thư mục gốc lưu file (tương đối với app hoặc tuyệt đối).</summary>
    public string RootPath { get; set; } = "uploads";

    /// <summary>Kích thước tối đa mỗi file (mặc định 20MB).</summary>
    public long MaxSizeBytes { get; set; } = 20 * 1024 * 1024;

    /// <summary>Hạn mức dung lượng cộng dồn mỗi user (mặc định 200MB; ≤0 = không giới hạn).</summary>
    public long PerUserQuotaBytes { get; set; } = 200L * 1024 * 1024;

    /// <summary>Danh sách content-type cho phép; rỗng = cho phép tất cả (cổng phụ).</summary>
    public string[] AllowedContentTypes { get; set; } = [];

    /// <summary>Danh sách phần mở rộng cho phép (vd ".pdf"); rỗng = cho phép tất cả. Cổng chính, ổn định hơn content-type.</summary>
    public string[] AllowedExtensions { get; set; } = [];

    /// <summary>Số ngày giữ file đã xóa mềm trước khi dọn vật lý (mặc định 30 ngày).</summary>
    public int CleanupRetentionDays { get; set; } = 30;
}
