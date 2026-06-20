using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Identity;
using HungSilver.Infrastructure.Persistence;
using HungSilver.Infrastructure.Persistence.Interceptors;
using HungSilver.Infrastructure.Storage;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>
/// Kiểm thử pha "mark" của FileCleanupService: dò file rác (StoredFile không còn ai tham chiếu,
/// đã quá hạn ân hạn) và đánh dấu xóa mềm, đồng thời giữ lại file vẫn còn tham chiếu / còn trong
/// hạn ân hạn / chỉ được bản ghi đã xóa mềm trỏ tới (bảo thủ).
/// </summary>
public sealed class FileCleanupReconcileTests : IDisposable
{
    private const int GraceHours = 24;

    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;

    public FileCleanupReconcileTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .AddInterceptors(new AuditSaveChangesInterceptor())
            .Options;

        _context = new AppDbContext(options);
        _context.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    /// <summary>Tạo StoredFile rồi lùi CreatedAt về quá khứ (interceptor chỉ set CreatedAt lúc Add).</summary>
    private async Task<StoredFile> AddFileAsync(double ageHours)
    {
        var file = new StoredFile
        {
            FileName = "f.jpg",
            ContentType = "image/jpeg",
            SizeBytes = 1,
            StoragePath = $"2026/06/{Guid.NewGuid():N}.jpg",
            Sha256 = Guid.NewGuid().ToString("N")
        };
        _context.StoredFiles.Add(file);
        await _context.SaveChangesAsync();

        file.CreatedAt = DateTime.Now.AddHours(-ageHours); // lùi về quá khứ (Modified giữ nguyên CreatedAt)
        await _context.SaveChangesAsync();
        return file;
    }

    private async Task<bool> IsSoftDeletedAsync(Guid id)
    {
        var raw = await _context.StoredFiles.IgnoreQueryFilters().SingleAsync(f => f.Id == id);
        return raw.IsDeleted;
    }

    [Fact]
    public async Task Orphan_PastGrace_IsSoftDeleted()
    {
        var file = await AddFileAsync(ageHours: 48); // quá hạn ân hạn 24h, không ai tham chiếu

        var marked = await FileCleanupService.ReconcileOrphansCoreAsync(_context, GraceHours);

        Assert.Equal(1, marked);
        Assert.True(await IsSoftDeletedAsync(file.Id));
    }

    [Fact]
    public async Task WithinGrace_IsKept()
    {
        var file = await AddFileAsync(ageHours: 1); // mới upload, còn trong hạn ân hạn

        var marked = await FileCleanupService.ReconcileOrphansCoreAsync(_context, GraceHours);

        Assert.Equal(0, marked);
        Assert.False(await IsSoftDeletedAsync(file.Id));
    }

    [Fact]
    public async Task ReferencedByMaterial_IsKept()
    {
        var file = await AddFileAsync(ageHours: 48);
        _context.LearningMaterials.Add(new LearningMaterial
        {
            Title = "Tài liệu",
            Source = MaterialSource.ServerFile,
            StoredFileId = file.Id
        });
        await _context.SaveChangesAsync();

        var marked = await FileCleanupService.ReconcileOrphansCoreAsync(_context, GraceHours);

        Assert.Equal(0, marked);
        Assert.False(await IsSoftDeletedAsync(file.Id));
    }

    [Fact]
    public async Task ReferencedByAvatarUrl_IsKept()
    {
        var file = await AddFileAsync(ageHours: 48);
        _context.Users.Add(new AppUser
        {
            UserName = "u1",
            AvatarUrl = $"/api/files/{file.Id}"
        });
        await _context.SaveChangesAsync();

        var marked = await FileCleanupService.ReconcileOrphansCoreAsync(_context, GraceHours);

        Assert.Equal(0, marked);
        Assert.False(await IsSoftDeletedAsync(file.Id));
    }

    [Fact]
    public async Task ReferencedBySoftDeletedMaterial_IsKept()
    {
        var file = await AddFileAsync(ageHours: 48);
        var material = new LearningMaterial
        {
            Title = "Tài liệu",
            Source = MaterialSource.ServerFile,
            StoredFileId = file.Id
        };
        _context.LearningMaterials.Add(material);
        await _context.SaveChangesAsync();

        // Xóa mềm tài liệu → file vẫn phải được giữ (có thể khôi phục tài liệu sau).
        _context.LearningMaterials.Remove(material);
        await _context.SaveChangesAsync();

        var marked = await FileCleanupService.ReconcileOrphansCoreAsync(_context, GraceHours);

        Assert.Equal(0, marked);
        Assert.False(await IsSoftDeletedAsync(file.Id));
    }
}
