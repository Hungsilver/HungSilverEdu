using System.Security.Cryptography;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Files;
using HungSilver.Application.Settings;
using HungSilver.Domain.Common;
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

    public async Task<Result<StoredFileDto>> UploadAsync(
        Stream content, string fileName, string contentType, long length,
        bool enforceStorageMode = true,
        FileVisibility visibility = FileVisibility.Authenticated,
        CancellationToken ct = default)
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

        var extension = (Path.GetExtension(fileName) ?? string.Empty).ToLowerInvariant();

        if (_options.AllowedExtensions.Length > 0 &&
            !_options.AllowedExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase))
            return Result.Failure<StoredFileDto>(Error.Validation(
                "Files.TypeNotAllowed", $"Không cho phép loại file '{extension}'."));

        if (_options.AllowedContentTypes.Length > 0 &&
            !_options.AllowedContentTypes.Contains(contentType, StringComparer.OrdinalIgnoreCase))
            return Result.Failure<StoredFileDto>(Error.Validation(
                "Files.TypeNotAllowed", $"Không cho phép loại file '{contentType}'."));

        // Giới hạn độ dài tên (cột FileName tối đa 260).
        if (fileName.Length > 260)
        {
            var stem = Path.GetFileNameWithoutExtension(fileName);
            var keep = Math.Max(0, Math.Min(stem.Length, 260 - extension.Length));
            fileName = string.Concat(stem.AsSpan(0, keep), extension);
        }

        // Cần stream seek được để kiểm chữ ký + tính hash rồi tua lại lưu.
        await using var buffer = content.CanSeek ? null : new MemoryStream();
        var work = content;
        if (buffer is not null)
        {
            await content.CopyToAsync(buffer, ct);
            buffer.Position = 0;
            work = buffer;
        }

        // Magic-byte: đọc N byte đầu kiểm chữ ký khớp đuôi.
        work.Seek(0, SeekOrigin.Begin);
        var header = new byte[FileSignatureValidator.RequiredHeaderBytes];
        var read = await work.ReadAsync(header.AsMemory(), ct);
        if (!FileSignatureValidator.IsContentValid(extension, header.AsSpan(0, read)))
            return Result.Failure<StoredFileDto>(Error.Validation(
                "Files.ContentMismatch", "Nội dung file không khớp với phần mở rộng."));

        // SHA-256 toàn nội dung (ETag + dedup + toàn vẹn).
        work.Seek(0, SeekOrigin.Begin);
        var hashBytes = await SHA256.HashDataAsync(work, ct);
        var sha = Convert.ToHexString(hashBytes).ToLowerInvariant();
        work.Seek(0, SeekOrigin.Begin);

        // Hạn mức theo user (chỉ với upload do user khởi tạo; bỏ qua Admin).
        if (enforceStorageMode && _options.PerUserQuotaBytes > 0 &&
            currentUser.UserId is Guid uid && !currentUser.IsInRole(AppRoles.Admin))
        {
            var owned = await files.FindAsync(f => f.UploadedByUserId == uid, ct);
            var used = owned.Sum(f => f.SizeBytes);
            if (used + length > _options.PerUserQuotaBytes)
                return Result.Failure<StoredFileDto>(Error.Validation(
                    "Files.QuotaExceeded",
                    $"Vượt hạn mức dung lượng {_options.PerUserQuotaBytes / (1024 * 1024)}MB của bạn."));
        }

        // Dedup: file trùng nội dung (SHA-256 + size) còn sống ⇒ tái dùng file vật lý, không ghi bản sao.
        var duplicate = (await files.FindAsync(f => f.Sha256 == sha && f.SizeBytes == length, ct)).FirstOrDefault();
        string storagePath;
        long size;
        if (duplicate is not null)
        {
            storagePath = duplicate.StoragePath;
            size = duplicate.SizeBytes;
        }
        else
        {
            var saved = await fileStorage.SaveAsync(work, fileName, contentType, ct);
            storagePath = saved.StoragePath;
            size = saved.SizeBytes;
        }

        var entity = new StoredFile
        {
            FileName = fileName,
            ContentType = contentType,
            SizeBytes = size,
            StoragePath = storagePath,
            Sha256 = sha,
            Visibility = visibility,
            UploadedByUserId = currentUser.UserId
        };

        await files.AddAsync(entity, ct);
        await unitOfWork.SaveChangesAsync(ct);

        return ToDto(entity);
    }

    public async Task<Result<StoredFileInfo>> GetInfoAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await files.GetByIdAsync(id, ct: ct);
        if (entity is null)
            return Result.Failure<StoredFileInfo>(Error.NotFound("Files.NotFound", "Không tìm thấy file."));

        return new StoredFileInfo(entity.Id, entity.FileName, entity.ContentType, entity.SizeBytes,
            entity.Sha256, entity.Visibility, entity.UploadedByUserId);
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
