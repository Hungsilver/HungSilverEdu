using HungSilver.Application.Abstractions;
using HungSilver.Application.Classes;
using HungSilver.Application.Common;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Infrastructure.Classes;
using HungSilver.Infrastructure.Common;
using HungSilver.Infrastructure.Persistence;
using HungSilver.Infrastructure.Persistence.Interceptors;
using HungSilver.Infrastructure.Persistence.Repositories;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HungSilver.UnitTests;

public sealed class ClassServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;

    public ClassServiceTests()
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

    [Fact]
    public async Task TeacherCreate_WithEmptyTeacherProfileId_UsesLinkedTeacherProfile()
    {
        var userId = Guid.NewGuid();
        var teacher = new TeacherProfile
        {
            TeacherCode = "GV001",
            FullName = "Trương Duy Hồng",
            UserId = userId,
            IsActive = true
        };
        _context.TeacherProfiles.Add(teacher);
        await _context.SaveChangesAsync();

        var service = NewClassService(new StubCurrentUser(userId, isAdmin: false));
        var result = await service.CreateAsync(new CreateClassRequest(
            ClassCode: null,
            Name: "Tiếng anh 10",
            TeacherProfileId: Guid.Empty,
            BranchId: null,
            SubjectId: null,
            GradeId: null,
            TuitionFee: 200000,
            CurriculumId: null,
            MaxCapacity: 20,
            Schedule: null,
            StartDate: null,
            IsActive: true));

        Assert.True(result.IsSuccess, result.IsFailure ? result.Error.Message : null);
        Assert.Equal(teacher.Id, result.Value.TeacherProfileId);
        Assert.Equal("Trương Duy Hồng", result.Value.TeacherName);
    }

    private ClassService NewClassService(ICurrentUser currentUser)
    {
        var guard = new ClassAccessGuard(
            currentUser,
            new Repository<ClassRoom>(_context),
            new Repository<TeacherProfile>(_context),
            new Repository<Enrollment>(_context));

        return new ClassService(
            _context,
            guard,
            new CurrentRelationCleanupService(_context),
            new CreateClassRequestValidator(),
            new UpdateClassRequestValidator());
    }

    private sealed class StubCurrentUser(Guid userId, bool isAdmin) : ICurrentUser
    {
        public Guid? UserId => userId;
        public string? Email => "teacher@hedu.local";
        public bool IsAuthenticated => true;
        public bool IsInRole(string role) => isAdmin && role == AppRoles.Admin || !isAdmin && role == AppRoles.Teacher;
    }
}
