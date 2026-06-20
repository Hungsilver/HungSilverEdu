using HungSilver.Application.Abstractions;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HungSilver.Infrastructure.Storage;

/// <summary>
/// Dịch vụ nền dọn file, chạy mỗi 24h với 2 pha:
/// <list type="number">
/// <item><b>Reconcile (mark)</b> — dò các StoredFile đang sống mà KHÔNG còn ai tham chiếu
/// (file rác: upload bị bỏ rơi, hoặc file cũ bị thay) và đã quá hạn ân hạn
/// <see cref="FileStorageOptions.OrphanGracePeriodHours"/> → đánh dấu xóa mềm.</item>
/// <item><b>Purge (sweep)</b> — xóa vật lý + xóa cứng metadata của StoredFile đã xóa mềm quá
/// hạn giữ <see cref="FileStorageOptions.CleanupRetentionDays"/>. Chỉ xóa file trên đĩa khi không
/// còn bản ghi SỐNG nào trỏ tới cùng StoragePath (refcount cho dedup). Hard-delete bằng
/// ExecuteDelete (bỏ qua interceptor soft-delete).</item>
/// </list>
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
            // Pha 1: đánh dấu file rác (không tham chiếu) → xóa mềm.
            try
            {
                await ReconcileOrphansAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Lỗi khi dò file rác (reconcile orphan).");
            }

            // Pha 2: xóa vật lý + xóa cứng metadata đã xóa mềm quá hạn giữ. Độc lập với pha 1.
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

    /// <summary>
    /// Pha "mark": dò các StoredFile đang sống mà không còn ai tham chiếu và đã quá hạn ân hạn,
    /// rồi đánh dấu xóa mềm (interceptor đặt IsDeleted=true, DeletedAt=now). File sẽ được pha
    /// <see cref="PurgeAsync"/> xóa vật lý sau khi quá hạn giữ — vẫn còn cửa sổ khôi phục.
    /// </summary>
    private async Task ReconcileOrphansAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var marked = await ReconcileOrphansCoreAsync(db, _options.OrphanGracePeriodHours, ct);
        if (marked > 0)
            logger.LogInformation("Dò file rác: đánh dấu xóa mềm {Count} file không được tham chiếu.", marked);
    }

    /// <summary>
    /// Lõi pha "mark" (tách riêng để test được): gom mọi tham chiếu file đang tồn tại, rồi đánh dấu
    /// xóa mềm các StoredFile đang sống, đã quá hạn ân hạn <paramref name="graceHours"/> mà không
    /// nằm trong tập tham chiếu. Trả về số file đã đánh dấu. KHÔNG tự tạo scope/log — caller lo.
    /// </summary>
    public static async Task<int> ReconcileOrphansCoreAsync(AppDbContext db, int graceHours, CancellationToken ct = default)
    {
        var grace = DateTime.Now.AddHours(-Math.Max(1, graceHours));

        // Gom mọi tham chiếu file đang tồn tại. Dùng IgnoreQueryFilters() là CỐ Ý (bảo thủ): kể cả
        // tài liệu/user đã xóa mềm vẫn giữ file của nó sống, để nếu bản ghi đó được khôi phục thì
        // ảnh/tệp không bị hỏng. File chỉ thật sự thành rác khi bản ghi tham chiếu bị xóa cứng hẳn.
        // LƯU Ý mở rộng: hiện chưa có rich-text nhúng <img src="/api/files/{id}"> vào các field
        // content. Nếu sau này thêm, PHẢI quét thêm các field đó vào tập tham chiếu này.
        var referenced = new HashSet<Guid>();

        referenced.UnionWith(await db.LearningMaterials
            .IgnoreQueryFilters()
            .Where(m => m.StoredFileId != null)
            .Select(m => m.StoredFileId!.Value)
            .ToListAsync(ct));

        var avatarUrls = await db.Users
            .IgnoreQueryFilters()
            .Where(u => u.AvatarUrl != null)
            .Select(u => u.AvatarUrl!)
            .ToListAsync(ct);
        foreach (var url in avatarUrls)
            if (TryParseFileId(url, out var id))
                referenced.Add(id);

        // Ứng viên = file đang sống (query filter mặc định ẩn bản đã xóa) và đã quá hạn ân hạn.
        // Lọc orphan trong bộ nhớ theo tập tham chiếu (quy mô app nhỏ).
        var candidates = await db.StoredFiles
            .Where(f => f.CreatedAt < grace)
            .ToListAsync(ct);
        var orphans = candidates.Where(f => !referenced.Contains(f.Id)).ToList();
        if (orphans.Count == 0)
            return 0;

        db.StoredFiles.RemoveRange(orphans); // interceptor chuyển thành xóa mềm
        await db.SaveChangesAsync(ct);
        return orphans.Count;
    }

    /// <summary>Tách Guid ở cuối chuỗi URL dạng "/api/files/{guid}" (AvatarUrl).</summary>
    private static bool TryParseFileId(string url, out Guid id)
    {
        var i = url.LastIndexOf('/');
        return Guid.TryParse(i >= 0 ? url[(i + 1)..] : url, out id);
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
