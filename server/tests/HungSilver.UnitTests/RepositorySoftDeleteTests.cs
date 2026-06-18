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

    private static Product NewProduct(string sku = "SKU-001") => new()
    {
        Name = "Test product",
        Sku = sku,
        Price = 100
    };

    [Fact]
    public async Task Add_SetsCreatedAt()
    {
        var repo = new Repository<Product>(_context);

        var product = NewProduct();
        await repo.AddAsync(product);
        await _context.SaveChangesAsync();

        Assert.NotEqual(default, product.CreatedAt);
        Assert.False(product.IsDeleted);
    }

    [Fact]
    public async Task SoftDelete_ConvertsRemoveToUpdate_AndHidesFromQueries()
    {
        var repo = new Repository<Product>(_context);
        var product = NewProduct();
        await repo.AddAsync(product);
        await _context.SaveChangesAsync();

        repo.SoftDelete(product);
        await _context.SaveChangesAsync();

        // Query mặc định không thấy bản ghi đã xóa mềm
        Assert.Null(await repo.GetByIdAsync(product.Id));

        // Nhưng row vẫn tồn tại trong database với IsDeleted = true
        var raw = await _context.Products.IgnoreQueryFilters().SingleAsync(p => p.Id == product.Id);
        Assert.True(raw.IsDeleted);
        Assert.NotNull(raw.DeletedAt);
    }

    [Fact]
    public async Task Restore_MakesEntityVisibleAgain()
    {
        var repo = new Repository<Product>(_context);
        var product = NewProduct();
        await repo.AddAsync(product);
        await _context.SaveChangesAsync();

        repo.SoftDelete(product);
        await _context.SaveChangesAsync();

        var restored = await repo.RestoreAsync(product.Id);
        await _context.SaveChangesAsync();

        Assert.True(restored);
        var found = await repo.GetByIdAsync(product.Id);
        Assert.NotNull(found);
        Assert.False(found.IsDeleted);
        Assert.Null(found.DeletedAt);
    }

    [Fact]
    public async Task GetPaged_RespectsFilterAndIncludeDeleted()
    {
        var repo = new Repository<Product>(_context);
        for (var i = 0; i < 5; i++)
            await repo.AddAsync(NewProduct($"SKU-{i:000}"));
        await _context.SaveChangesAsync();

        var toDelete = await repo.GetByIdAsync((await repo.FindAsync(p => p.Sku == "SKU-000")).Single().Id);
        repo.SoftDelete(toDelete!);
        await _context.SaveChangesAsync();

        var visible = await repo.GetPagedAsync(1, 10);
        Assert.Equal(4, visible.TotalCount);

        var all = await repo.GetPagedAsync(1, 10, includeDeleted: true);
        Assert.Equal(5, all.TotalCount);
    }

    [Fact]
    public async Task Update_SetsUpdatedAt()
    {
        var repo = new Repository<Product>(_context);
        var product = NewProduct();
        await repo.AddAsync(product);
        await _context.SaveChangesAsync();

        product.Name = "Renamed";
        repo.Update(product);
        await _context.SaveChangesAsync();

        Assert.NotNull(product.UpdatedAt);
    }
}
