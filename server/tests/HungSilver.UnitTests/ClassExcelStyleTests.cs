using ClosedXML.Excel;
using HungSilver.Application.Classes;
using HungSilver.Application.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Infrastructure.Classes;
using HungSilver.Infrastructure.Common;
using HungSilver.Infrastructure.Persistence;
using HungSilver.Infrastructure.Persistence.Interceptors;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HungSilver.UnitTests;

public sealed class ClassExcelStyleTests : IDisposable
{
    private static readonly XLColor HeaderIndigo = XLColor.FromHtml("#4F46E5");
    private static readonly XLColor HeaderYellow = XLColor.FromHtml("#FFFFC8");

    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;
    private readonly CurrentRelationCleanupService _cleanup;

    public ClassExcelStyleTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .AddInterceptors(new AuditSaveChangesInterceptor())
            .Options;

        _context = new AppDbContext(options);
        _context.Database.EnsureCreated();
        _cleanup = new CurrentRelationCleanupService(_context);
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public void ClassImportTemplate_UsesReadableHeaderColors()
    {
        var bytes = new ClassImportService(_context).BuildTemplate();

        using var wb = OpenWorkbook(bytes);

        AssertHeaderStyle(wb.Worksheet("Nhập liệu").Cell("A1"), HeaderIndigo, XLColor.White);
        AssertHeaderStyle(wb.Worksheet("Danh mục").Cell("A1"), HeaderYellow, HeaderIndigo);
    }

    [Fact]
    public async Task ClassExport_UsesReadableHeaderColors()
    {
        var result = await NewClassService().ExportAsync();

        Assert.True(result.IsSuccess);
        using var wb = OpenWorkbook(result.Value);

        AssertHeaderStyle(wb.Worksheet("Data").Cell("A1"), HeaderIndigo, XLColor.White);
        AssertHeaderStyle(wb.Worksheet("Danh mục").Cell("A1"), HeaderYellow, HeaderIndigo);
    }

    private ClassService NewClassService() =>
        new(
            _context,
            new AdminGuard(),
            _cleanup,
            new CreateClassRequestValidator(),
            new UpdateClassRequestValidator());

    private static XLWorkbook OpenWorkbook(byte[] bytes) =>
        new(new MemoryStream(bytes));

    private static void AssertHeaderStyle(IXLCell cell, XLColor expectedFill, XLColor expectedFont)
    {
        Assert.True(cell.Style.Font.Bold);
        Assert.Equal(expectedFill.Color.ToArgb(), cell.Style.Fill.BackgroundColor.Color.ToArgb());
        Assert.Equal(expectedFont.Color.ToArgb(), cell.Style.Font.FontColor.Color.ToArgb());
    }

    private sealed class AdminGuard : IClassAccessGuard
    {
        public bool IsAdmin => true;
        public Task<Guid?> GetTeacherScopeIdAsync(CancellationToken ct = default) => Task.FromResult<Guid?>(null);
        public Task<Result> EnsureCanAccessClassAsync(Guid classId, CancellationToken ct = default) => Task.FromResult(Result.Success());
        public Task<bool> CanAccessClassAsync(Guid classId, CancellationToken ct = default) => Task.FromResult(true);
        public Task<Result> EnsureCanAccessStudentAsync(Guid studentId, CancellationToken ct = default) => Task.FromResult(Result.Success());
    }
}
