using HungSilver.Domain.Entities;
using HungSilver.Infrastructure.Persistence;
using HungSilver.Infrastructure.Persistence.Interceptors;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>
/// Kiểm thử partial unique index trên UserId (1 tài khoản ↔ 1 học sinh / 1 giáo viên):
/// chặn 2 entity còn-sống cùng trỏ về một UserId, nhưng cho phép sau khi gỡ liên kết / xóa mềm.
/// </summary>
public sealed class AccountLinkUniqueIndexTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;

    public AccountLinkUniqueIndexTests()
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

    private static Student Student(Guid? userId, string code) =>
        new() { StudentCode = code, FullName = "HS", UserId = userId, IsActive = true };

    [Fact]
    public async Task TwoStudents_SameUser_IsRejected()
    {
        var userId = Guid.NewGuid();
        _context.Students.Add(Student(userId, "2K9A0"));
        await _context.SaveChangesAsync();

        _context.Students.Add(Student(userId, "2K9B0"));
        await Assert.ThrowsAsync<DbUpdateException>(() => _context.SaveChangesAsync());
    }

    [Fact]
    public async Task RelinkAfterUnlink_IsAllowed()
    {
        var userId = Guid.NewGuid();
        var first = Student(userId, "2K9A0");
        _context.Students.Add(first);
        await _context.SaveChangesAsync();

        // Gỡ liên kết bản cũ → ra khỏi phạm vi index (UserId = null).
        first.UserId = null;
        await _context.SaveChangesAsync();

        _context.Students.Add(Student(userId, "2K9B0"));
        var ex = await Record.ExceptionAsync(() => _context.SaveChangesAsync());
        Assert.Null(ex);
    }

    [Fact]
    public async Task TwoTeachers_SameUser_IsRejected()
    {
        var userId = Guid.NewGuid();
        _context.TeacherProfiles.Add(new TeacherProfile { TeacherCode = "GVA0", FullName = "GV A", UserId = userId });
        await _context.SaveChangesAsync();

        _context.TeacherProfiles.Add(new TeacherProfile { TeacherCode = "GVB0", FullName = "GV B", UserId = userId });
        await Assert.ThrowsAsync<DbUpdateException>(() => _context.SaveChangesAsync());
    }

    [Fact]
    public async Task MultipleStudents_NullUser_IsAllowed()
    {
        _context.Students.Add(Student(null, "2K9A0"));
        _context.Students.Add(Student(null, "2K9B0"));
        var ex = await Record.ExceptionAsync(() => _context.SaveChangesAsync());
        Assert.Null(ex);
    }
}
