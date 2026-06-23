using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Domain.Common;
using HungSilver.Domain.Entities;
using HungSilver.Infrastructure.Persistence;
using HungSilver.Infrastructure.Persistence.Interceptors;
using HungSilver.Infrastructure.Persistence.Repositories;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>
/// Kiểm thử "viên đá đỉnh vòm" phân quyền theo Giáo viên: Admin toàn quyền; GV chỉ lớp/HS của mình;
/// GV chưa liên kết hồ sơ thấy rỗng. Đây là guard mọi service nghiệp vụ gọi để scope dữ liệu.
/// </summary>
public sealed class ClassAccessGuardTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;

    private readonly Guid _userA = Guid.NewGuid();
    private readonly Guid _userB = Guid.NewGuid();
    private Guid _profileA, _profileB, _classA, _classB, _studentA, _studentB;

    public ClassAccessGuardTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .AddInterceptors(new AuditSaveChangesInterceptor())
            .Options;

        _context = new AppDbContext(options);
        _context.Database.EnsureCreated();
        SeedAsync().GetAwaiter().GetResult();
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task Admin_NoScope_SeesEveryClassAndStudent()
    {
        var guard = NewGuard(isAdmin: true, userId: Guid.NewGuid());

        Assert.Null(await guard.GetTeacherScopeIdAsync());
        Assert.True((await guard.EnsureCanAccessClassAsync(_classA)).IsSuccess);
        Assert.True((await guard.EnsureCanAccessClassAsync(_classB)).IsSuccess);
        Assert.True((await guard.EnsureCanAccessStudentAsync(_studentB)).IsSuccess);
    }

    [Fact]
    public async Task Teacher_ScopedToOwnClassesAndStudents()
    {
        var guard = NewGuard(isAdmin: false, userId: _userA);

        Assert.Equal(_profileA, await guard.GetTeacherScopeIdAsync());
        Assert.True((await guard.EnsureCanAccessClassAsync(_classA)).IsSuccess);
        Assert.True((await guard.EnsureCanAccessStudentAsync(_studentA)).IsSuccess);

        var otherClass = await guard.EnsureCanAccessClassAsync(_classB);
        Assert.True(otherClass.IsFailure);
        Assert.Equal("Class.NotFound", otherClass.Error.Code);

        var otherStudent = await guard.EnsureCanAccessStudentAsync(_studentB);
        Assert.True(otherStudent.IsFailure);
        Assert.Equal("Student.NotFound", otherStudent.Error.Code);
    }

    [Fact]
    public async Task TeacherWithoutProfile_ScopeEmpty_SeesNothing()
    {
        var guard = NewGuard(isAdmin: false, userId: Guid.NewGuid());

        Assert.Equal(Guid.Empty, await guard.GetTeacherScopeIdAsync());
        Assert.True((await guard.EnsureCanAccessClassAsync(_classA)).IsFailure);
        Assert.True((await guard.EnsureCanAccessStudentAsync(_studentA)).IsFailure);
    }

    [Fact]
    public async Task NonExistentClass_ReturnsNotFound_EvenForAdmin()
    {
        var guard = NewGuard(isAdmin: true, userId: Guid.NewGuid());
        var result = await guard.EnsureCanAccessClassAsync(Guid.NewGuid());
        Assert.True(result.IsFailure);
        Assert.Equal("Class.NotFound", result.Error.Code);
    }

    private ClassAccessGuard NewGuard(bool isAdmin, Guid userId) =>
        new(
            new StubCurrentUser(userId, isAdmin),
            new Repository<ClassRoom>(_context),
            new Repository<TeacherProfile>(_context),
            new Repository<Enrollment>(_context));

    private async Task SeedAsync()
    {
        var pA = new TeacherProfile { TeacherCode = "GVA", FullName = "Cô A", UserId = _userA, IsActive = true };
        var pB = new TeacherProfile { TeacherCode = "GVB", FullName = "Thầy B", UserId = _userB, IsActive = true };
        _context.TeacherProfiles.AddRange(pA, pB);

        var cA = new ClassRoom { Name = "Lớp A", TeacherProfileId = pA.Id, MaxCapacity = 30 };
        var cB = new ClassRoom { Name = "Lớp B", TeacherProfileId = pB.Id, MaxCapacity = 30 };
        _context.Classes.AddRange(cA, cB);

        var sA = new Student { StudentCode = "HSA", FullName = "Học sinh A" };
        var sB = new Student { StudentCode = "HSB", FullName = "Học sinh B" };
        _context.Students.AddRange(sA, sB);

        _context.Enrollments.Add(new Enrollment { ClassId = cA.Id, StudentId = sA.Id, EnrolledOn = DateOnly.FromDateTime(DateTime.Now), IsActive = true });
        _context.Enrollments.Add(new Enrollment { ClassId = cB.Id, StudentId = sB.Id, EnrolledOn = DateOnly.FromDateTime(DateTime.Now), IsActive = true });

        await _context.SaveChangesAsync();

        _profileA = pA.Id; _profileB = pB.Id;
        _classA = cA.Id; _classB = cB.Id;
        _studentA = sA.Id; _studentB = sB.Id;
    }

    private sealed class StubCurrentUser(Guid userId, bool isAdmin) : ICurrentUser
    {
        public Guid? UserId => userId;
        public string? Email => "stub@hedu.local";
        public bool IsAuthenticated => true;
        public bool IsInRole(string role) => isAdmin && role == AppRoles.Admin;
    }
}
