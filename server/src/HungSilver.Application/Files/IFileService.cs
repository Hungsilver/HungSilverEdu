using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Files;

/// <summary>
/// Upload/tải file. Upload chỉ được phép khi cấu hình FileStorage.Mode = "Server" (do Admin đặt);
/// nếu là "ExternalUrl" thì từ chối và yêu cầu lưu link ngoài.
/// </summary>
public interface IFileService
{
    /// <param name="enforceStorageMode">
    /// true (mặc định): chỉ cho upload khi FileStorage.Mode = Server. false: luôn lưu server
    /// (dùng cho ảnh đại diện — không phụ thuộc cấu hình lưu link ngoài).
    /// </param>
    Task<Result<StoredFileDto>> UploadAsync(Stream content, string fileName, string contentType, long length, bool enforceStorageMode = true, CancellationToken ct = default);

    Task<Result<StoredFileDownload>> GetForDownloadAsync(Guid id, CancellationToken ct = default);
}

public sealed record StoredFileDto(Guid Id, string FileName, string ContentType, long SizeBytes, string Url);

public sealed record StoredFileDownload(Stream Content, string ContentType, string FileName);
