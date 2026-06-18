using HungSilver.Application.Abstractions;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HungSilver.Infrastructure.Storage;

/// <summary>
/// Dọn file vật lý của StoredFile đã xóa mềm quá hạn giữ. Chỉ xóa file trên đĩa khi không còn
/// bản ghi SỐNG nào trỏ tới cùng StoragePath (refcount cho dedup), rồi xóa cứng metadata.
/// Chạy nền mỗi 24h. Phải hard-delete bằng ExecuteDelete (bỏ qua interceptor soft-delete).
/// </summary>
public sealed class FileCleanupService(
    IServiceScopeFactory scopeFactory,
    IOptions<FileStorageOptions> options,
    ILogger<FileCleanupService> logger) : BackgroundService
{
    private readonly FileStorageOptions _options = options.Value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PurgeAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Lỗi khi dọn file đã xóa mềm.");
            }

            try
            {
                await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
            }
            catch (TaskCanceledException)
            {
                break;
            }
        }
    }

    private async Task PurgeAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var sp = scope.ServiceProvider;
        var db = sp.GetRequiredService<AppDbContext>();
        var storage = sp.GetRequiredService<IFileStorage>();

        var threshold = DateTime.Now.AddDays(-Math.Max(1, _options.CleanupRetentionDays));

        // Bản ghi đã xóa mềm quá hạn (bỏ qua query filter để thấy bản đã xóa).
        var stale = await db.StoredFiles
            .IgnoreQueryFilters()
            .Where(f => f.IsDeleted && f.DeletedAt != null && f.DeletedAt < threshold)
            .ToListAsync(ct);

        if (stale.Count == 0)
            return;

        var removedFiles = 0;
        foreach (var file in stale)
        {
            // Còn bản ghi SỐNG nào dùng cùng StoragePath? (query filter mặc định chỉ đếm bản chưa xóa)
            var stillReferenced = await db.StoredFiles.AnyAsync(f => f.StoragePath == file.StoragePath, ct);
            if (!stillReferenced)
            {
                await storage.DeleteAsync(file.StoragePath, ct);
                removedFiles++;
            }
        }

        // Hard-delete metadata: ExecuteDelete chạy SQL trực tiếp, không qua interceptor soft-delete.
        var ids = stale.Select(f => f.Id).ToList();
        var deletedRows = await db.StoredFiles
            .IgnoreQueryFilters()
            .Where(f => ids.Contains(f.Id))
            .ExecuteDeleteAsync(ct);

        logger.LogInformation("Dọn file: hard-delete {Rows} metadata, xóa {Files} file vật lý.", deletedRows, removedFiles);
    }
}
