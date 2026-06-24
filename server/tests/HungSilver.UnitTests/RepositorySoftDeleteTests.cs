using HungSilver.Domain.Entities;
using HungSilver.Infrastructure.Persistence;
using HungSilver.Infrastructure.Persistence.Interceptors;
using HungSilver.Infrastructure.Persistence.Repositories;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HungSilver.UnitTests;

public sealed class RepositorySoftDeleteTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;

    public RepositorySoftDeleteTests()
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

    // Branch là entity BaseEntity đơn giản, dùng làm mẫu để kiểm Repository generic.
    private static Branch NewBranch(string code = "B-001") => new()
    {
        Code = code,
        Name = "Cơ sở test"
    };

    [Fact]
    public async Task Add_SetsCreatedAt()
    {
        var repo = new Repository<Branch>(_context);

        var branch = NewBranch();
        await repo.AddAsync(branch);
        await _context.SaveChangesAsync();

        Assert.NotEqual(default, branch.CreatedAt);
        Assert.False(branch.IsDeleted);
    }

    [Fact]
    public async Task SoftDelete_ConvertsRemoveToUpdate_AndHidesFromQueries()
    {
        var repo = new Repository<Branch>(_context);
        var branch = NewBranch();
        await repo.AddAsync(branch);
        await _context.SaveChangesAsync();

        repo.SoftDelete(branch);
        await _context.SaveChangesAsync();

        // Query mặc định không thấy bản ghi đã xóa mềm
        Assert.Null(await repo.GetByIdAsync(branch.Id));

        // Nhưng row vẫn tồn tại trong database với IsDeleted = true
        var raw = await _context.Branches.IgnoreQueryFilters().SingleAsync(b => b.Id == branch.Id);
        Assert.True(raw.IsDeleted);
        Assert.NotNull(raw.DeletedAt);
    }

    [Fact]
    public async Task Restore_MakesEntityVisibleAgain()
    {
        var repo = new Repository<Branch>(_context);
        var branch = NewBranch();
        await repo.AddAsync(branch);
        await _context.SaveChangesAsync();

        repo.SoftDelete(branch);
        await _context.SaveChangesAsync();

        var restored = await repo.RestoreAsync(branch.Id);
        await _context.SaveChangesAsync();

        Assert.True(restored);
        var found = await repo.GetByIdAsync(branch.Id);
        Assert.NotNull(found);
        Assert.False(found.IsDeleted);
        Assert.Null(found.DeletedAt);
    }

    [Fact]
    public async Task GetPaged_RespectsFilterAndIncludeDeleted()
    {
        var repo = new Repository<Branch>(_context);
        for (var i = 0; i < 5; i++)
            await repo.AddAsync(NewBranch($"B-{i:000}"));
        await _context.SaveChangesAsync();

        var toDelete = await repo.GetByIdAsync((await repo.FindAsync(b => b.Code == "B-000")).Single().Id);
        repo.SoftDelete(toDelete!);
        await _context.SaveChangesAsync();

        var visible = await repo.GetPagedAsync(1, 10);
        Assert.Equal(4, visible.TotalCount);

        var all = await repo.GetPagedAsync(1, 10, includeDeleted: true);
        Assert.Equal(5, all.TotalCount);
    }

    [Fact]
    public async Task FindAsync_ReturnsNewestCreatedFirst()
    {
        var repo = new Repository<Branch>(_context);
        var older = NewBranch("B-OLD");
        var newer = NewBranch("B-NEW");
        await repo.AddAsync(older);
        await repo.AddAsync(newer);
        await _context.SaveChangesAsync();

        // Gán CreatedAt rõ ràng để kiểm thứ tự tất định (interceptor chỉ set CreatedAt khi Added).
        older.CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Local);
        newer.CreatedAt = new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Local);
        repo.Update(older);
        repo.Update(newer);
        await _context.SaveChangesAsync();

        var list = await repo.FindAsync(_ => true);

        // Mặc định mới nhất lên đầu
        Assert.Equal(newer.Id, list[0].Id);
        Assert.Equal(older.Id, list[1].Id);
    }

    [Fact]
    public async Task Update_SetsUpdatedAt()
    {
        var repo = new Repository<Branch>(_context);
        var branch = NewBranch();
        await repo.AddAsync(branch);
        await _context.SaveChangesAsync();

        branch.Name = "Đổi tên";
        repo.Update(branch);
        await _context.SaveChangesAsync();

        Assert.NotNull(branch.UpdatedAt);
    }
}
