namespace HungSilver.Application.Abstractions;

/// <summary>Trừu tượng lưu trữ file. Bản hiện tại lưu ổ đĩa server; có thể đổi sang S3/MinIO sau.</summary>
public interface IFileStorage
{
    Task<StoredFileResult> SaveAsync(Stream content, string fileName, string contentType, CancellationToken ct = default);

    Task<Stream?> OpenReadAsync(string storagePath, CancellationToken ct = default);

    Task DeleteAsync(string storagePath, CancellationToken ct = default);
}

public sealed record StoredFileResult(string StoragePath, long SizeBytes);
