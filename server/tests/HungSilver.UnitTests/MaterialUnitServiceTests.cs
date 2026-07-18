using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
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
/// Unit/Chương trong Bộ tài liệu (Bộ → Unit → Tài liệu): derive số hiển thị xen kẽ Unit/Review,
/// reorder khớp chính xác tập unit, chặn xóa unit còn tài liệu, chặn xóa bộ còn unit,
/// gán tài liệu vào unit sai bộ bị từ chối.
/// </summary>
public sealed class MaterialUnitServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;
    private readonly Guid _subjectId;
    private readonly Guid _folderId;

    public MaterialUnitServiceTests()
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

        var folder = new MaterialFolder { SubjectId = _subjectId, SubjectName = "Tiếng Anh", Name = "Tiếng Anh 10", GradeBand = "10" };
        _context.MaterialFolders.Add(folder);
        _context.SaveChanges();
        _folderId = folder.Id;
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    private MaterialUnitService NewService() => new(
        new Repository<MaterialUnit>(_context),
        new Repository<MaterialFolder>(_context),
        new Repository<LearningMaterial>(_context),
        new UnitOfWork(_context),
        new CreateMaterialUnitRequestValidator(),
        new UpdateMaterialUnitRequestValidator(),
        new ReorderMaterialUnitsRequestValidator());

    private MaterialFolderService NewFolderService() => new(
        new Repository<MaterialFolder>(_context),
        new Repository<LearningMaterial>(_context),
        new Repository<MaterialUnit>(_context),
        new Repository<Subject>(_context),
        new Repository<StoredFile>(_context),
        new UnitOfWork(_context),
        new CreateMaterialFolderRequestValidator(),
        new UpdateMaterialFolderRequestValidator());

    private MaterialService NewMaterialService() => new(
        new Repository<LearningMaterial>(_context),
        new Repository<MaterialCategory>(_context),
        new Repository<Subject>(_context),
        new Repository<StoredFile>(_context),
        new Repository<MaterialFolder>(_context),
        new Repository<MaterialUnit>(_context),
        new AdminGuard(),
        new CurrentRelationCleanupService(_context),
        new UnitOfWork(_context),
        new FakeCurrentUser(),
        new CreateMaterialRequestValidator(),
        new UpdateMaterialRequestValidator());

    private LearningMaterial SeedMaterialInUnit(Guid unitId, string title = "Getting Started")
    {
        var m = new LearningMaterial
        {
            Code = "TL" + Guid.NewGuid().ToString("N")[..6],
            FolderId = _folderId,
            UnitId = unitId,
            SubjectId = _subjectId,
            SubjectName = "Tiếng Anh",
            Title = title,
            Source = MaterialSource.ExternalUrl,
            Url = "https://x.vn/tl"
        };
        _context.LearningMaterials.Add(m);
        _context.SaveChanges();
        return m;
    }

    [Fact]
    public async Task Create_DerivesNumbering_UnitAndReviewCountedSeparately()
    {
        var svc = NewService();

        // Thứ tự tạo: Unit, Unit, Review, Unit, Review — số derive theo vị trí, đếm riêng từng Kind.
        await svc.CreateAsync(new CreateMaterialUnitRequest(_folderId, MaterialUnitKind.Unit, "Family life"));
        await svc.CreateAsync(new CreateMaterialUnitRequest(_folderId, MaterialUnitKind.Unit, "Humans and the environment"));
        await svc.CreateAsync(new CreateMaterialUnitRequest(_folderId, MaterialUnitKind.Review, null));
        await svc.CreateAsync(new CreateMaterialUnitRequest(_folderId, MaterialUnitKind.Unit, "Music"));
        await svc.CreateAsync(new CreateMaterialUnitRequest(_folderId, MaterialUnitKind.Review, ""));

        var list = (await svc.GetByFolderAsync(_folderId)).Value;
        Assert.Equal(5, list.Count);
        Assert.Equal([1, 2, 1, 3, 2], list.Select(u => u.UnitNo).ToArray());
        Assert.Equal(
            [MaterialUnitKind.Unit, MaterialUnitKind.Unit, MaterialUnitKind.Review, MaterialUnitKind.Unit, MaterialUnitKind.Review],
            list.Select(u => u.Kind).ToArray());
        Assert.Equal(string.Empty, list[2].Name); // Review cho phép trống tên
    }

    [Fact]
    public async Task Create_UnitWithoutName_FailsValidation_AndUnknownFolderRejected()
    {
        var svc = NewService();

        var noName = await svc.CreateAsync(new CreateMaterialUnitRequest(_folderId, MaterialUnitKind.Unit, " "));
        Assert.Equal("MaterialUnit.Validation", noName.Error.Code);

        var badFolder = await svc.CreateAsync(new CreateMaterialUnitRequest(Guid.NewGuid(), MaterialUnitKind.Unit, "Music"));
        Assert.Equal("MaterialUnit.FolderNotFound", badFolder.Error.Code);
    }

    [Fact]
    public async Task Reorder_StrictMatch_ThenRenumbers()
    {
        var svc = NewService();
        var u1 = (await svc.CreateAsync(new CreateMaterialUnitRequest(_folderId, MaterialUnitKind.Unit, "A"))).Value;
        var u2 = (await svc.CreateAsync(new CreateMaterialUnitRequest(_folderId, MaterialUnitKind.Unit, "B"))).Value;
        var r1 = (await svc.CreateAsync(new CreateMaterialUnitRequest(_folderId, MaterialUnitKind.Review, null))).Value;

        // Thiếu 1 id ⇒ từ chối (chống reorder trên dữ liệu cũ).
        var missing = await svc.ReorderAsync(new ReorderMaterialUnitsRequest(_folderId, [u2.Id, u1.Id]));
        Assert.Equal("MaterialUnit.ReorderInvalid", missing.Error.Code);

        // Trùng id ⇒ từ chối.
        var dup = await svc.ReorderAsync(new ReorderMaterialUnitsRequest(_folderId, [u2.Id, u2.Id, r1.Id]));
        Assert.Equal("MaterialUnit.ReorderInvalid", dup.Error.Code);

        // Đảo B lên đầu: B=Unit 1, A=Unit 2; Review giữ số 1.
        var ok = await svc.ReorderAsync(new ReorderMaterialUnitsRequest(_folderId, [u2.Id, r1.Id, u1.Id]));
        Assert.True(ok.IsSuccess);
        Assert.Equal([u2.Id, r1.Id, u1.Id], ok.Value.Select(u => u.Id).ToArray());
        Assert.Equal([1, 1, 2], ok.Value.Select(u => u.UnitNo).ToArray());

        // Thứ tự bền qua GetByFolder.
        var reloaded = (await svc.GetByFolderAsync(_folderId)).Value;
        Assert.Equal([u2.Id, r1.Id, u1.Id], reloaded.Select(u => u.Id).ToArray());
    }

    [Fact]
    public async Task Delete_BlockedWhileContainingMaterials_AllowedAfterChildrenMoved()
    {
        var svc = NewService();
        var unit = (await svc.CreateAsync(new CreateMaterialUnitRequest(_folderId, MaterialUnitKind.Unit, "A"))).Value;
        var child = SeedMaterialInUnit(unit.Id);

        var blocked = await svc.DeleteAsync(unit.Id);
        Assert.True(blocked.IsFailure);
        Assert.Equal("MaterialUnit.InUse", blocked.Error.Code);

        child.UnitId = null; // gỡ tài liệu khỏi unit
        await _context.SaveChangesAsync();

        Assert.True((await svc.DeleteAsync(unit.Id)).IsSuccess);
        Assert.Empty(await _context.MaterialUnits.Where(u => u.Id == unit.Id).ToListAsync()); // soft delete ⇒ query filter ẩn
    }

    [Fact]
    public async Task FolderDelete_BlockedWhileContainingUnits()
    {
        var unitSvc = NewService();
        var folderSvc = NewFolderService();
        var unit = (await unitSvc.CreateAsync(new CreateMaterialUnitRequest(_folderId, MaterialUnitKind.Unit, "A"))).Value;

        var blocked = await folderSvc.DeleteAsync(_folderId);
        Assert.True(blocked.IsFailure);
        Assert.Equal("MaterialFolder.HasUnits", blocked.Error.Code);

        Assert.True((await unitSvc.DeleteAsync(unit.Id)).IsSuccess);
        Assert.True((await folderSvc.DeleteAsync(_folderId)).IsSuccess);
    }

    [Fact]
    public async Task MaterialCreate_UnitMustBelongToFolder_GeneralMaterialForcesNullUnit()
    {
        var unitSvc = NewService();
        var materialSvc = NewMaterialService();
        var unit = (await unitSvc.CreateAsync(new CreateMaterialUnitRequest(_folderId, MaterialUnitKind.Unit, "A"))).Value;

        var otherFolder = new MaterialFolder { SubjectId = _subjectId, SubjectName = "Tiếng Anh", Name = "Tiếng Anh 11" };
        _context.MaterialFolders.Add(otherFolder);
        await _context.SaveChangesAsync();

        // Unit thuộc bộ khác ⇒ từ chối.
        var wrongFolder = await materialSvc.CreateAsync(new CreateMaterialRequest(
            null, null, null, "Getting Started", MaterialSource.ExternalUrl, "https://x.vn/tl", null, null, null,
            FolderId: otherFolder.Id, UnitId: unit.Id));
        Assert.Equal("Material.UnitNotInFolder", wrongFolder.Error.Code);

        // Đúng bộ ⇒ lưu UnitId.
        var ok = await materialSvc.CreateAsync(new CreateMaterialRequest(
            null, null, null, "Getting Started", MaterialSource.ExternalUrl, "https://x.vn/tl", null, null, null,
            FolderId: _folderId, UnitId: unit.Id));
        Assert.True(ok.IsSuccess);
        Assert.Equal(unit.Id, ok.Value.UnitId);

        // Tài liệu chung (không bộ) ⇒ UnitId bị ép null dù client gửi.
        var general = await materialSvc.CreateAsync(new CreateMaterialRequest(
            SeedCategory(), _subjectId, null,
            "Tài liệu chung", MaterialSource.ExternalUrl, "https://x.vn/tl", null, null, null,
            FolderId: null, UnitId: unit.Id));
        Assert.True(general.IsSuccess);
        Assert.Null(general.Value.UnitId);
    }

    private Guid SeedCategory()
    {
        var cat = new MaterialCategory { Name = "Đề kiểm tra", SortOrder = 1 };
        _context.MaterialCategories.Add(cat);
        _context.SaveChanges();
        return cat.Id;
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
