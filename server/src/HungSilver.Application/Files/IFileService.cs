using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Files;

/// <summary>
/// Upload/tải file. Upload chỉ được phép khi cấu hình FileStorage.Mode = "Server" (do Admin đặt);
/// nếu là "ExternalUrl" thì từ chối và yêu cầu lưu link ngoài.
/// </summary>
public interface IFileService
{
    Task<Result<StoredFileDto>> UploadAsync(Stream content, string fileName, string contentType, long length, CancellationToken ct = default);

    Task<Result<StoredFileDownload>> GetForDownloadAsync(Guid id, CancellationToken ct = default);
}

public sealed record StoredFileDto(Guid Id, string FileName, string ContentType, long SizeBytes, string Url);

public sealed record StoredFileDownload(Stream Content, string ContentType, string FileName);
