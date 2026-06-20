using HungSilver.Application.Abstractions;
using Microsoft.Extensions.Options;

namespace HungSilver.Infrastructure.Storage;

/// <summary>Lưu file xuống ổ đĩa server. StoragePath lưu tương đối với RootPath.</summary>
public sealed class LocalDiskFileStorage(IOptions<FileStorageOptions> options) : IFileStorage
{
    private readonly FileStorageOptions _options = options.Value;

    public async Task<StoredFileResult> SaveAsync(Stream content, string fileName, string contentType, CancellationToken ct = default)
    {
        var root = GetRoot();
        // Phân thư mục theo năm/tháng (UTC) để tránh dồn quá nhiều file vào một chỗ.
        var now = DateTime.Now;
        var subDir = Path.Combine(now.Year.ToString(), now.Month.ToString("D2"));
        Directory.CreateDirectory(Path.Combine(root, subDir));

        var storedName = $"{Guid.NewGuid():N}{Path.GetExtension(fileName)}";
        var fullPath = Path.Combine(root, subDir, storedName);

        await using (var fs = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write))
        {
            await content.CopyToAsync(fs, ct);
        }

        var size = new FileInfo(fullPath).Length;
        var relative = Path.Combine(subDir, storedName).Replace('\\', '/');
        return new StoredFileResult(relative, size);
    }

    public Task<Stream?> OpenReadAsync(string storagePath, CancellationToken ct = default)
    {
        var fullPath = ResolvePath(storagePath);
        if (!File.Exists(fullPath))
            return Task.FromResult<Stream?>(null);

        Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read);
        return Task.FromResult<Stream?>(stream);
    }

    public Task DeleteAsync(string storagePath, CancellationToken ct = default)
    {
        var fullPath = ResolvePath(storagePath);
        if (File.Exists(fullPath))
            File.Delete(fullPath);
        return Task.CompletedTask;
    }

    private string ResolvePath(string storagePath)
    {
        var root = GetRoot();
        var full = Path.GetFullPath(Path.Combine(root, storagePath.Replace('/', Path.DirectorySeparatorChar)));
        // Rào phòng thủ: đường dẫn phải nằm trong root (chống path traversal "../").
        var rootFull = Path.GetFullPath(root);
        if (!full.StartsWith(rootFull + Path.DirectorySeparatorChar, StringComparison.Ordinal) && full != rootFull)
            throw new InvalidOperationException("Đường dẫn file không hợp lệ.");
        return full;
    }

    private string GetRoot()
    {
        var root = _options.RootPath;
        if (!Path.IsPathRooted(root))
            root = Path.Combine(AppContext.BaseDirectory, root);
        Directory.CreateDirectory(root);
        return root;
    }
}
