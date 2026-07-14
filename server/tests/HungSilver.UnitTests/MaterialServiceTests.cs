using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Application.Common.Models;
using HungSilver.Application.Materials;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Common;
using HungSilver.Infrastructure.Persistence;
using HungSilver.Infrastructure.Persistence.Interceptors;
using HungSilver.Infrastructure.Persistence.Repositories;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>
/// Kiểm thử Kho tài liệu thiết kế mới: mã TL0001 tăng dần (không tái cấp sau xóa mềm),
/// danh sách phân trang lọc môn/loại/khối + search, update không đổi mã, validator môn/loại bắt buộc.
/// </summary>
public sealed class MaterialServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;
    private readonly Guid _subjectId;
    private readonly Guid _categoryId;

    public MaterialServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .AddInterceptors(new AuditSaveChangesInterceptor())
            .Options;
        _context = new AppDbContext(options);
        _context.Database.EnsureCreated();

        var subject = new Subject { Code = "ANH", Name = "Tiếng Anh" };
        var category = new MaterialCategory { Name = "Đề kiểm tra", SortOrder = 1 };
        _context.Subjects.Add(subject);
        _context.MaterialCategories.Add(category);
        _context.SaveChanges();
        _subjectId = subject.Id;
        _categoryId = category.Id;
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    private MaterialService NewService() => new(
        new Repository<LearningMaterial>(_context),
        new Repository<MaterialCategory>(_context),
        new Repository<Subject>(_context),
        new Repository<StoredFile>(_context),
        new Repository<MaterialFolder>(_context),
        new AdminGuard(),
        new CurrentRelationCleanupService(_context),
        new UnitOfWork(_context),
        new FakeCurrentUser(),
        new CreateMaterialRequestValidator(),
        new UpdateMaterialRequestValidator());

    private MaterialFolder SeedFolder(string name = "Tiếng Anh 10", string? gradeBand = "10")
    {
        var folder = new MaterialFolder { SubjectId = _subjectId, SubjectName = "Tiếng Anh", Name = name, GradeBand = gradeBand };
        _context.MaterialFolders.Add(folder);
        _context.SaveChanges();
        return folder;
    }

    private CreateMaterialRequest NewRequest(string title, string? gradeBand = null, Guid? coverFileId = null) =>
        new(_categoryId, _subjectId, gradeBand, title, MaterialSource.ExternalUrl, "https://x.vn/tl", null, null, coverFileId);

    private async Task<StoredFile> SeedStoredFileAsync(string contentType = "image/png")
    {
        var file = new StoredFile
        {
            FileName = "cover.png",
            ContentType = contentType,
            SizeBytes = 1,
            StoragePath = $"2026/07/{Guid.NewGuid():N}.png",
            Sha256 = Guid.NewGuid().ToString("N")
        };
        _context.StoredFiles.Add(file);
        await _context.SaveChangesAsync();
        return file;
    }

    [Fact]
    public async Task Create_GeneratesSequentialCodes()
    {
        var svc = NewService();

        var first = await svc.CreateAsync(NewRequest("Tài liệu 1"));
        var second = await svc.CreateAsync(NewRequest("Tài liệu 2"));

        Assert.True(first.IsSuccess);
        Assert.Equal("TL0001", first.Value.Code);
        Assert.Equal("TL0002", second.Value.Code);
        Assert.Equal("Tiếng Anh", first.Value.SubjectName);
        Assert.Equal("Đề kiểm tra", first.Value.CategoryName);
    }

    [Fact]
    public async Task Create_AfterSoftDelete_DoesNotReuseCode()
    {
        var svc = NewService();
        await svc.CreateAsync(NewRequest("Tài liệu 1"));
        var second = await svc.CreateAsync(NewRequest("Tài liệu 2"));

        var deleted = await svc.DeleteAsync(second.Value.Id);
        Assert.True(deleted.IsSuccess);

        var third = await svc.CreateAsync(NewRequest("Tài liệu 3"));
        Assert.Equal("TL0003", third.Value.Code); // TL0002 đã cấp cho bản ghi xóa mềm — không tái cấp
    }

    [Fact]
    public async Task GetPaged_FiltersBySearchSubjectCategoryGradeBand()
    {
        var svc = NewService();
        await svc.CreateAsync(NewRequest("Unit 3 Grade 9", gradeBand: "9"));
        await svc.CreateAsync(NewRequest("Unit 1 Grade 6", gradeBand: "6"));

        var byBand = await svc.GetPagedAsync(new MaterialListFilter { GradeBand = "9" }, new PagedRequest());
        Assert.Single(byBand.Value.Items);
        Assert.Equal("Unit 3 Grade 9", byBand.Value.Items[0].Title);

        var bySearchCode = await svc.GetPagedAsync(new MaterialListFilter(), new PagedRequest { Search = "tl0002" });
        Assert.Single(bySearchCode.Value.Items);
        Assert.Equal("TL0002", bySearchCode.Value.Items[0].Code);

        var bySubject = await svc.GetPagedAsync(new MaterialListFilter { SubjectId = _subjectId, CategoryId = _categoryId }, new PagedRequest());
        Assert.Equal(2, bySubject.Value.TotalCount);

        var noMatch = await svc.GetPagedAsync(new MaterialListFilter { SubjectId = Guid.NewGuid() }, new PagedRequest());
        Assert.Empty(noMatch.Value.Items);
    }

    [Fact]
    public async Task Update_KeepsCode()
    {
        var svc = NewService();
        var created = await svc.CreateAsync(NewRequest("Tên cũ"));

        var updated = await svc.UpdateAsync(created.Value.Id,
            new UpdateMaterialRequest(_categoryId, _subjectId, "9", "Tên mới", MaterialSource.ExternalUrl, "https://x.vn/tl2", null, null, null));

        Assert.True(updated.IsSuccess);
        Assert.Equal("Tên mới", updated.Value.Title);
        Assert.Equal(created.Value.Code, updated.Value.Code);
    }

    [Fact]
    public async Task Create_WithoutSubjectOrCategory_FailsValidation()
    {
        var svc = NewService();

        var noSubject = await svc.CreateAsync(new CreateMaterialRequest(_categoryId, null, null, "T", MaterialSource.ExternalUrl, "https://x.vn", null, null, null));
        var noCategory = await svc.CreateAsync(new CreateMaterialRequest(null, _subjectId, null, "T", MaterialSource.ExternalUrl, "https://x.vn", null, null, null));

        Assert.True(noSubject.IsFailure);
        Assert.True(noCategory.IsFailure);
        Assert.Equal("Material.Validation", noSubject.Error.Code);
    }

    [Fact]
    public async Task Create_InFolder_SnapshotsSubjectFromFolder_CategoryOptional()
    {
        var svc = NewService();
        var folder = SeedFolder(gradeBand: "10");

        // Không gửi Subject/Category/GradeBand — chỉ FolderId (form tối giản); client có gửi Subject lạ cũng bị bỏ qua.
        var created = await svc.CreateAsync(new CreateMaterialRequest(
            null, Guid.NewGuid(), "99", "Unit 1", MaterialSource.ExternalUrl, "https://x.vn/u1", null, null, null, folder.Id));

        Assert.True(created.IsSuccess);
        Assert.Equal(folder.Id, created.Value.FolderId);
        Assert.Equal(_subjectId, created.Value.SubjectId);        // snapshot TỪ BỘ, bỏ qua Guid lạ client gửi
        Assert.Equal("Tiếng Anh", created.Value.SubjectName);
        Assert.Equal("10", created.Value.GradeBand);              // kế thừa Khối của bộ, bỏ qua "99"
        Assert.Null(created.Value.CategoryId);
    }

    [Fact]
    public async Task Create_WithMissingFolder_Fails()
    {
        var svc = NewService();
        var result = await svc.CreateAsync(new CreateMaterialRequest(
            null, null, null, "Unit 1", MaterialSource.ExternalUrl, "https://x.vn/u1", null, null, null, Guid.NewGuid()));
        Assert.True(result.IsFailure);
        Assert.Equal("Material.FolderNotFound", result.Error.Code);
    }

    [Fact]
    public async Task GetPaged_FiltersByFolder_AndGeneralOnly()
    {
        var svc = NewService();
        var folder = SeedFolder();
        await svc.CreateAsync(new CreateMaterialRequest(
            null, null, null, "Unit 1", MaterialSource.ExternalUrl, "https://x.vn/u1", null, null, null, folder.Id));
        await svc.CreateAsync(NewRequest("Tài liệu chung")); // FolderId null

        var inFolder = await svc.GetPagedAsync(new MaterialListFilter { FolderId = folder.Id }, new PagedRequest());
        Assert.Single(inFolder.Value.Items);
        Assert.Equal("Unit 1", inFolder.Value.Items[0].Title);

        var general = await svc.GetPagedAsync(new MaterialListFilter { GeneralOnly = true }, new PagedRequest());
        Assert.Single(general.Value.Items);
        Assert.Equal("Tài liệu chung", general.Value.Items[0].Title);

        var all = await svc.GetPagedAsync(new MaterialListFilter(), new PagedRequest());
        Assert.Equal(2, all.Value.TotalCount);
    }

    [Fact]
    public async Task Create_Update_RoundTripsCoverFileId()
    {
        var svc = NewService();
        var cover = await SeedStoredFileAsync();

        var created = await svc.CreateAsync(NewRequest("Tài liệu có bìa", coverFileId: cover.Id));
        Assert.True(created.IsSuccess);
        Assert.Equal(cover.Id, created.Value.CoverFileId);

        // Gỡ ảnh bìa khi sửa ⇒ về null (file cũ thành orphan, FileCleanupService dọn — không lỗi).
        var updated = await svc.UpdateAsync(created.Value.Id,
            new UpdateMaterialRequest(_categoryId, _subjectId, null, "Tài liệu có bìa", MaterialSource.ExternalUrl, "https://x.vn/tl", null, null, null));
        Assert.True(updated.IsSuccess);
        Assert.Null(updated.Value.CoverFileId);
    }

    [Fact]
    public async Task Create_WithInvalidCover_Fails()
    {
        var svc = NewService();

        // Ảnh bìa trỏ file không tồn tại.
        var missing = await svc.CreateAsync(NewRequest("T", coverFileId: Guid.NewGuid()));
        Assert.True(missing.IsFailure);
        Assert.Equal("Materials.CoverNotFound", missing.Error.Code);

        // File tồn tại nhưng không phải ảnh.
        var pdf = await SeedStoredFileAsync(contentType: "application/pdf");
        var notImage = await svc.CreateAsync(NewRequest("T", coverFileId: pdf.Id));
        Assert.True(notImage.IsFailure);
        Assert.Equal("Materials.CoverNotImage", notImage.Error.Code);
    }

    // ----- Fakes -----

    private sealed class FakeCurrentUser : ICurrentUser
    {
        public Guid? UserId => Guid.NewGuid();
        public string? Email => "gv@hs.local";
        public bool IsAuthenticated => true;
        public bool IsInRole(string role) => true;
    }

    private sealed class AdminGuard : IClassAccessGuard
    {
        public bool IsAdmin => true;
        public Task<Guid?> GetTeacherScopeIdAsync(CancellationToken ct = default) => Task.FromResult<Guid?>(null);
        public Task<List<Guid>> GetOwnedClassIdsAsync(CancellationToken ct = default) => Task.FromResult(new List<Guid>());
        public Task<Result> EnsureCanAccessClassAsync(Guid classId, CancellationToken ct = default) => Task.FromResult(Result.Success());
        public Task<bool> CanAccessClassAsync(Guid classId, CancellationToken ct = default) => Task.FromResult(true);
        public Task<Result> EnsureCanAccessStudentAsync(Guid studentId, CancellationToken ct = default) => Task.FromResult(Result.Success());
    }
}
