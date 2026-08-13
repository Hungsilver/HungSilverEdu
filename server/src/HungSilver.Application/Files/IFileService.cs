using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.Files;

/// <summary>
/// Upload/tải file. Upload chỉ được phép khi cấu hình <c>FileStorage.AllowServerUpload = true</c> (do Admin đặt);
/// tắt thì từ chối và yêu cầu dùng đường dẫn ngoài. Validate: dung lượng, phần mở rộng,
/// chữ ký nội dung (magic-byte), hạn mức theo user; dedup theo SHA-256.
/// </summary>
public interface IFileService
{
    /// <param name="enforceStorageMode">
    /// true (mặc định): chỉ cho upload khi <c>FileStorage.AllowServerUpload = true</c> và áp hạn mức/user.
    /// false: luôn lưu server, bỏ qua hạn mức — dùng cho file KHÔNG nhập kho (ảnh đại diện, ảnh bìa,
    /// file nguồn sinh đề), vì các luồng đó không phụ thuộc cấu hình cách nạp tài liệu.
    /// </param>
    /// <param name="visibility">Mức truy cập khi tải xuống (mặc định Authenticated).</param>
    Task<Result<StoredFileDto>> UploadAsync(
        Stream content, string fileName, string contentType, long length,
        bool enforceStorageMode = true,
        FileVisibility visibility = FileVisibility.Authenticated,
        CancellationToken ct = default);

    /// <summary>Metadata file (không mở stream) — để phân quyền tải + tính ETag trước.</summary>
    Task<Result<StoredFileInfo>> GetInfoAsync(Guid id, CancellationToken ct = default);

    /// <summary>Mở stream nội dung file để trả về client.</summary>
    Task<Result<StoredFileDownload>> GetForDownloadAsync(Guid id, CancellationToken ct = default);
}

public sealed record StoredFileDto(Guid Id, string FileName, string ContentType, long SizeBytes, string Url);

public sealed record StoredFileInfo(
    Guid Id, string FileName, string ContentType, long SizeBytes,
    string Sha256, FileVisibility Visibility, Guid? UploadedByUserId);

public sealed record StoredFileDownload(Stream Content, string ContentType, string FileName);
