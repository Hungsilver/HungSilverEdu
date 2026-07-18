using HungSilver.Application.Materials;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using HungSilver.Infrastructure.Persistence.Interceptors;
using HungSilver.Infrastructure.Persistence.Repositories;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>
/// Bộ tài liệu: CRUD + snapshot Môn (bất biến), đồng bộ Khối cho tài liệu con khi đổi,
/// chặn xóa bộ còn tài liệu, đếm số bộ/tài liệu cho màn mức 1.
/// </summary>
public sealed class MaterialFolderServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;
    private readonly Guid _subjectId;

    public MaterialFolderServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .AddInterceptors(new AuditSaveChangesInterceptor())
            .Options;
        _context = new AppDbContext(options);
        _context.Database.EnsureCreated();

        var subject = new Subject { Code = "ANH", Name = "Tiếng Anh", IndexOrder = 1, IsActive = true };
        _context.Subjects.Add(subject);
        _context.SaveChanges();
        _subjectId = subject.Id;
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    private MaterialFolderService NewService() => new(
        new Repository<MaterialFolder>(_context),
        new Repository<LearningMaterial>(_context),
        new Repository<MaterialUnit>(_context),
        new Repository<Subject>(_context),
        new Repository<StoredFile>(_context),
        new UnitOfWork(_context),
        new CreateMaterialFolderRequestValidator(),
        new UpdateMaterialFolderRequestValidator());

    private LearningMaterial SeedMaterialInFolder(Guid folderId, string title = "Unit 1", string? gradeBand = "10")
    {
        var m = new LearningMaterial
        {
            Code = "TL" + Guid.NewGuid().ToString("N")[..6],
            FolderId = folderId,
            SubjectId = _subjectId,
            SubjectName = "Tiếng Anh",
            GradeBand = gradeBand,
            Title = title,
            Source = MaterialSource.ExternalUrl,
            Url = "https://x.vn/tl"
        };
        _context.LearningMaterials.Add(m);
        _context.SaveChanges();
        return m;
    }

    [Fact]
    public async Task Create_SnapshotsSubjectName_AndValidates()
    {
        var svc = NewService();

        var created = await svc.CreateAsync(new CreateMaterialFolderRequest(_subjectId, "Tiếng Anh 10", "10", null, "Bộ SGK"));
        Assert.True(created.IsSuccess);
        Assert.Equal("Tiếng Anh", created.Value.SubjectName);
        Assert.Equal("10", created.Value.GradeBand);
        Assert.Equal(0, created.Value.MaterialCount);

        var badSubject = await svc.CreateAsync(new CreateMaterialFolderRequest(Guid.NewGuid(), "Bộ X", null, null, null));
        Assert.Equal("MaterialFolder.SubjectNotFound", badSubject.Error.Code);

        var noName = await svc.CreateAsync(new CreateMaterialFolderRequest(_subjectId, " ", null, null, null));
        Assert.Equal("MaterialFolder.Validation", noName.Error.Code);
    }

    [Fact]
    public async Task Update_ChangesGradeBand_SyncsChildren_KeepsSubject()
    {
        var svc = NewService();
        var folder = (await svc.CreateAsync(new CreateMaterialFolderRequest(_subjectId, "Tiếng Anh 10", "10", null, null))).Value;
        SeedMaterialInFolder(folder.Id, "Unit 1", "10");
        SeedMaterialInFolder(folder.Id, "Unit 2", "10");

        var updated = await svc.UpdateAsync(folder.Id, new UpdateMaterialFolderRequest("Tiếng Anh 11", "11", null, null));

        Assert.True(updated.IsSuccess);
        Assert.Equal("Tiếng Anh 11", updated.Value.Name);
        Assert.Equal("11", updated.Value.GradeBand);
        Assert.Equal(_subjectId, updated.Value.SubjectId); // Môn bất biến
        Assert.Equal(2, updated.Value.MaterialCount);

        var children = await _context.LearningMaterials.Where(m => m.FolderId == folder.Id).ToListAsync();
        Assert.All(children, m => Assert.Equal("11", m.GradeBand)); // Khối đồng bộ xuống tài liệu con
    }

    [Fact]
    public async Task Update_CoverNotImage_Fails()
    {
        var svc = NewService();
        var folder = (await svc.CreateAsync(new CreateMaterialFolderRequest(_subjectId, "Bộ A", null, null, null))).Value;

        var pdf = new StoredFile { FileName = "f.pdf", ContentType = "application/pdf", SizeBytes = 1, StoragePath = "p/f.pdf", Sha256 = "a" };
        _context.StoredFiles.Add(pdf);
        await _context.SaveChangesAsync();

        var result = await svc.UpdateAsync(folder.Id, new UpdateMaterialFolderRequest("Bộ A", null, pdf.Id, null));
        Assert.Equal("Materials.CoverNotImage", result.Error.Code);
    }

    [Fact]
    public async Task Delete_BlockedWhileContainingMaterials_AllowedAfterChildrenDeleted()
    {
        var svc = NewService();
        var folder = (await svc.CreateAsync(new CreateMaterialFolderRequest(_subjectId, "Bộ A", null, null, null))).Value;
        var child = SeedMaterialInFolder(folder.Id);

        var blocked = await svc.DeleteAsync(folder.Id);
        Assert.True(blocked.IsFailure);
        Assert.Equal("MaterialFolder.InUse", blocked.Error.Code);

        _context.LearningMaterials.Remove(child); // xóa mềm tài liệu con
        await _context.SaveChangesAsync();

        Assert.True((await svc.DeleteAsync(folder.Id)).IsSuccess);
        Assert.Empty(await _context.MaterialFolders.Where(f => f.Id == folder.Id).ToListAsync()); // soft delete ⇒ query filter ẩn
    }

    [Fact]
    public async Task GetBySubject_ReturnsFoldersWithCounts()
    {
        var svc = NewService();
        var a = (await svc.CreateAsync(new CreateMaterialFolderRequest(_subjectId, "Tiếng Anh 10", "10", null, null))).Value;
        var b = (await svc.CreateAsync(new CreateMaterialFolderRequest(_subjectId, "Tiếng Anh 11", "11", null, null))).Value;
        SeedMaterialInFolder(a.Id, "Unit 1");
        SeedMaterialInFolder(a.Id, "Unit 2");

        var list = (await svc.GetBySubjectAsync(_subjectId)).Value;

        Assert.Equal(2, list.Count);
        Assert.Equal(2, list.First(f => f.Id == a.Id).MaterialCount);
        Assert.Equal(0, list.First(f => f.Id == b.Id).MaterialCount);
    }

    [Fact]
    public async Task SubjectsSummary_IncludesActiveWithoutFolders_AndOrphanSnapshotSubjects()
    {
        var svc = NewService();
        // Môn active thứ 2 chưa có bộ nào — vẫn phải hiện để GV tạo bộ đầu tiên.
        _context.Subjects.Add(new Subject { Code = "TOAN", Name = "Toán", IndexOrder = 2, IsActive = true });
        await _context.SaveChangesAsync();

        var folder = (await svc.CreateAsync(new CreateMaterialFolderRequest(_subjectId, "Tiếng Anh 10", null, null, null))).Value;
        SeedMaterialInFolder(folder.Id);

        // Môn "mồ côi": chỉ còn trong snapshot của bộ (không có trong bảng Subjects).
        _context.MaterialFolders.Add(new MaterialFolder { SubjectId = Guid.NewGuid(), SubjectName = "Môn đã gỡ", Name = "Bộ cũ" });
        await _context.SaveChangesAsync();

        var summary = (await svc.GetSubjectsSummaryAsync()).Value;

        Assert.Equal(3, summary.Count);
        var anh = summary.First(s => s.SubjectId == _subjectId);
        Assert.Equal(1, anh.FolderCount);
        Assert.Equal(1, anh.MaterialCount);
        Assert.Equal(0, summary.First(s => s.SubjectName == "Toán").FolderCount);
        Assert.Equal(1, summary.First(s => s.SubjectName == "Môn đã gỡ").FolderCount);
    }
}
