using HungSilver.Domain.Entities;
using HungSilver.Infrastructure.Persistence;
using HungSilver.Infrastructure.Persistence.Interceptors;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>
/// Kiểm thử partial unique index `Enrollment(StudentId, ClassId)` lọc theo còn-hiệu-lực (B4):
/// chặn ghi danh trùng khi ĐANG active, nhưng cho ghi danh lại sau khi rút lớp / xóa mềm.
/// </summary>
public sealed class EnrollmentUniqueIndexTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;

    public EnrollmentUniqueIndexTests()
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

    private static DateOnly Today => DateOnly.FromDateTime(DateTime.Now);

    private Enrollment Active(Guid studentId, Guid classId) =>
        new() { StudentId = studentId, ClassId = classId, IsActive = true, EnrolledOn = Today };

    [Fact]
    public async Task DuplicateActiveEnrollment_IsRejected()
    {
        var studentId = Guid.NewGuid();
        var classId = Guid.NewGuid();

        _context.Enrollments.Add(Active(studentId, classId));
        await _context.SaveChangesAsync();

        _context.Enrollments.Add(Active(studentId, classId));
        await Assert.ThrowsAsync<DbUpdateException>(() => _context.SaveChangesAsync());
    }

    [Fact]
    public async Task ReEnrollAfterWithdraw_IsAllowed()
    {
        var studentId = Guid.NewGuid();
        var classId = Guid.NewGuid();

        var first = Active(studentId, classId);
        _context.Enrollments.Add(first);
        await _context.SaveChangesAsync();

        // Rút khỏi lớp → bản cũ ra khỏi phạm vi index (IsActive=false).
        first.IsActive = false;
        first.WithdrawnOn = Today;
        await _context.SaveChangesAsync();

        _context.Enrollments.Add(Active(studentId, classId));
        var ex = await Record.ExceptionAsync(() => _context.SaveChangesAsync());
        Assert.Null(ex);
    }

    [Fact]
    public async Task SameStudentDifferentClasses_IsAllowed()
    {
        var studentId = Guid.NewGuid();

        _context.Enrollments.Add(Active(studentId, Guid.NewGuid()));
        _context.Enrollments.Add(Active(studentId, Guid.NewGuid()));
        var ex = await Record.ExceptionAsync(() => _context.SaveChangesAsync());
        Assert.Null(ex);
    }
}
