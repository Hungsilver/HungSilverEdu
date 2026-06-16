using HungSilver.Application.Abstractions;
using HungSilver.Application.Files;
using HungSilver.Application.Settings;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using Microsoft.Extensions.Options;

namespace HungSilver.Infrastructure.Storage;

public sealed class FileService(
    IFileStorage fileStorage,
    ISettingsResolver settings,
    IRepository<StoredFile> files,
    IUnitOfWork unitOfWork,
    ICurrentUser currentUser,
    IOptions<FileStorageOptions> options) : IFileService
{
    private readonly FileStorageOptions _options = options.Value;

    public async Task<Result<StoredFileDto>> UploadAsync(Stream content, string fileName, string contentType, long length, bool enforceStorageMode = true, CancellationToken ct = default)
    {
        if (enforceStorageMode)
        {
            var mode = await settings.GetEffectiveValueAsync(SettingKeys.FileStorageMode, ct: ct);
            if (!string.Equals(mode, nameof(FileStorageMode.Server), StringComparison.OrdinalIgnoreCase))
                return Result.Failure<StoredFileDto>(Error.Validation(
                    "Files.UploadDisabled",
                    "Hệ thống đang ở chế độ lưu link ngoài. Vui lòng dùng đường dẫn URL thay vì upload file."));
        }

        if (length <= 0)
            return Result.Failure<StoredFileDto>(Error.Validation("Files.Empty", "File rỗng."));

        if (length > _options.MaxSizeBytes)
            return Result.Failure<StoredFileDto>(Error.Validation(
                "Files.TooLarge", $"File vượt quá kích thước tối đa {_options.MaxSizeBytes / (1024 * 1024)}MB."));

        if (_options.AllowedContentTypes.Length > 0 &&
            !_options.AllowedContentTypes.Contains(contentType, StringComparer.OrdinalIgnoreCase))
            return Result.Failure<StoredFileDto>(Error.Validation("Files.TypeNotAllowed", $"Không cho phép loại file '{contentType}'."));

        var saved = await fileStorage.SaveAsync(content, fileName, contentType, ct);

        var entity = new StoredFile
        {
            FileName = fileName,
            ContentType = contentType,
            SizeBytes = saved.SizeBytes,
            StoragePath = saved.StoragePath,
            UploadedByUserId = currentUser.UserId
        };

        await files.AddAsync(entity, ct);
        await unitOfWork.SaveChangesAsync(ct);

        return ToDto(entity);
    }

    public async Task<Result<StoredFileDownload>> GetForDownloadAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await files.GetByIdAsync(id, ct: ct);
        if (entity is null)
            return Result.Failure<StoredFileDownload>(Error.NotFound("Files.NotFound", "Không tìm thấy file."));

        var stream = await fileStorage.OpenReadAsync(entity.StoragePath, ct);
        if (stream is null)
            return Result.Failure<StoredFileDownload>(Error.NotFound("Files.NotFound", "Không tìm thấy nội dung file."));

        return new StoredFileDownload(stream, entity.ContentType, entity.FileName);
    }

    private static StoredFileDto ToDto(StoredFile f) =>
        new(f.Id, f.FileName, f.ContentType, f.SizeBytes, $"/api/files/{f.Id}");
}
