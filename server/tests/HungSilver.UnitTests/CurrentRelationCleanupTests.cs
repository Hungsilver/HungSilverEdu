using HungSilver.Application.Abstractions;
using HungSilver.Application.Accounts;
using HungSilver.Application.Classes;
using HungSilver.Application.Common;
using HungSilver.Application.Materials;
using HungSilver.Application.Students;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Classes;
using HungSilver.Infrastructure.Common;
using HungSilver.Infrastructure.Persistence;
using HungSilver.Infrastructure.Persistence.Interceptors;
using HungSilver.Infrastructure.Persistence.Repositories;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HungSilver.UnitTests;

public sealed class CurrentRelationCleanupTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;
    private readonly CurrentRelationCleanupService _cleanup;

    public CurrentRelationCleanupTests()
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
    public async Task DeleteStudent_SoftDeletesActiveEnrollments_ThenClassCanBeDeleted()
    {
        var classId = await AddClassAsync("Lớp A");
        var studentId = await AddStudentAsync("Nguyễn Văn A");
        var enrollmentId = await AddEnrollmentAsync(studentId, classId);

        var service = NewStudentService();
        var deleted = await service.DeleteAsync(studentId);

        Assert.True(deleted.IsSuccess);

        var enrollment = await _context.Enrollments.IgnoreQueryFilters().SingleAsync(e => e.Id == enrollmentId);
        Assert.True(enrollment.IsDeleted);
        Assert.False(enrollment.IsActive);
        Assert.NotNull(enrollment.WithdrawnOn);

        var classService = NewClassService();
        var classDeleted = await classService.DeleteAsync(classId);

        Assert.True(classDeleted.IsSuccess);
        Assert.True(await _context.Classes.IgnoreQueryFilters().AnyAsync(c => c.Id == classId && c.IsDeleted));
    }

    [Fact]
    public async Task DeleteClass_CleansActiveEnrollmentPointingToSoftDeletedStudent()
    {
        var classId = await AddClassAsync("Lớp B");
        var studentId = await AddStudentAsync("Trần Thị B");
        var enrollmentId = await AddEnrollmentAsync(studentId, classId);

        var student = await _context.Students.SingleAsync(s => s.Id == studentId);
        _context.Students.Remove(student);
        await _context.SaveChangesAsync();

        var classService = NewClassService();
        var result = await classService.DeleteAsync(classId);

        Assert.True(result.IsSuccess);

        var enrollment = await _context.Enrollments.IgnoreQueryFilters().SingleAsync(e => e.Id == enrollmentId);
        Assert.True(enrollment.IsDeleted);
        Assert.False(enrollment.IsActive);
        Assert.NotNull(enrollment.WithdrawnOn);
    }

    [Fact]
    public async Task DeleteClass_WithActiveValidStudents_SucceedsAndWithdrawsEnrollments()
    {
        var classId = await AddClassAsync("Lớp C");
        var studentId = await AddStudentAsync("Lê Văn C");
        var enrollmentId = await AddEnrollmentAsync(studentId, classId);

        var classService = NewClassService();
        var result = await classService.DeleteAsync(classId);

        Assert.True(result.IsSuccess);
        Assert.True(await _context.Classes.IgnoreQueryFilters().AnyAsync(c => c.Id == classId && c.IsDeleted));

        var enrollment = await _context.Enrollments.IgnoreQueryFilters().SingleAsync(e => e.Id == enrollmentId);
        Assert.True(enrollment.IsDeleted);
        Assert.False(enrollment.IsActive);
        Assert.NotNull(enrollment.WithdrawnOn);
    }

    [Fact]
    public async Task DeleteMaterial_NullsAssignmentsThatReferenceIt()
    {
        var category = new MaterialCategory { Name = "Thư viện", SortOrder = 1 };
        var material = new LearningMaterial
        {
            CategoryId = category.Id,
            Title = "Bài đọc",
            Type = MaterialType.Pdf,
            Source = MaterialSource.ExternalUrl,
            Url = "https://example.com/doc"
        };
        var assignment = new Assignment
        {
            ClassId = Guid.NewGuid(),
            MaterialId = material.Id,
            Title = "BTVN"
        };
        _context.MaterialCategories.Add(category);
        _context.LearningMaterials.Add(material);
        _context.Assignments.Add(assignment);
        await _context.SaveChangesAsync();

        var service = NewMaterialService();
        var result = await service.DeleteAsync(material.Id);

        Assert.True(result.IsSuccess);
        Assert.True(await _context.LearningMaterials.IgnoreQueryFilters().AnyAsync(m => m.Id == material.Id && m.IsDeleted));
        Assert.Null((await _context.Assignments.SingleAsync(a => a.Id == assignment.Id)).MaterialId);
    }

    [Fact]
    public async Task DeleteMaterialCategory_InUse_ReturnsConflict()
    {
        var category = new MaterialCategory { Name = "Bài đọc", SortOrder = 1 };
        _context.MaterialCategories.Add(category);
        _context.LearningMaterials.Add(new LearningMaterial
        {
            CategoryId = category.Id,
            Title = "Reading 1",
            Type = MaterialType.Pdf,
            Source = MaterialSource.ExternalUrl,
            Url = "https://example.com/reading"
        });
        await _context.SaveChangesAsync();

        var service = NewMaterialCategoryService();
        var result = await service.DeleteAsync(category.Id);

        Assert.True(result.IsFailure);
        Assert.Equal("MaterialCategory.InUse", result.Error.Code);
    }

    [Fact]
    public async Task UnlinkUserRelations_ClearsStudentAndTeacherLinks()
    {
        var userId = Guid.NewGuid();
        _context.Students.Add(new Student { StudentCode = "HS1", FullName = "Học sinh", UserId = userId });
        _context.TeacherProfiles.Add(new TeacherProfile { TeacherCode = "GV1", FullName = "Giáo viên", UserId = userId });
        await _context.SaveChangesAsync();

        await _cleanup.UnlinkUserRelationsAsync(userId);
        await _context.SaveChangesAsync();

        Assert.False(await _context.Students.AnyAsync(s => s.UserId == userId));
        Assert.False(await _context.TeacherProfiles.AnyAsync(t => t.UserId == userId));
    }

    private StudentService NewStudentService() =>
        new(
            new Repository<Student>(_context),
            new Repository<ClassRoom>(_context),
            new Repository<Enrollment>(_context),
            new AdminGuard(),
            _cleanup,
            new UnitOfWork(_context),
            new FakeUserDirectory(),
            new FakeAccountProvisioning(),
            new CreateStudentRequestValidator(),
            new UpdateStudentRequestValidator());

    private ClassService NewClassService() =>
        new(
            _context,
            new AdminGuard(),
            _cleanup,
            new CreateClassRequestValidator(),
            new UpdateClassRequestValidator());

    private MaterialService NewMaterialService() =>
        new(
            new Repository<LearningMaterial>(_context),
            new Repository<MaterialCategory>(_context),
            new Repository<Subject>(_context),
            new AdminGuard(),
            _cleanup,
            new UnitOfWork(_context),
            new TestCurrentUser(),
            new CreateMaterialRequestValidator(),
            new UpdateMaterialRequestValidator());

    private MaterialCategoryService NewMaterialCategoryService() =>
        new(new Repository<MaterialCategory>(_context), _cleanup, new UnitOfWork(_context));

    private async Task<Guid> AddClassAsync(string name)
    {
        var cls = new ClassRoom { Name = name, TeacherId = Guid.NewGuid(), MaxCapacity = 30 };
        _context.Classes.Add(cls);
        await _context.SaveChangesAsync();
        return cls.Id;
    }

    private async Task<Guid> AddStudentAsync(string fullName)
    {
        var student = new Student { StudentCode = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(), FullName = fullName };
        _context.Students.Add(student);
        await _context.SaveChangesAsync();
        return student.Id;
    }

    private async Task<Guid> AddEnrollmentAsync(Guid studentId, Guid classId)
    {
        var enrollment = new Enrollment
        {
            StudentId = studentId,
            ClassId = classId,
            EnrolledOn = DateOnly.FromDateTime(DateTime.Now),
            IsActive = true
        };
        _context.Enrollments.Add(enrollment);
        await _context.SaveChangesAsync();
        return enrollment.Id;
    }

    private sealed class AdminGuard : IClassAccessGuard
    {
        public bool IsAdmin => true;
        public Task<Guid?> GetTeacherScopeIdAsync(CancellationToken ct = default) => Task.FromResult<Guid?>(null);
        public Task<Result> EnsureCanAccessClassAsync(Guid classId, CancellationToken ct = default) => Task.FromResult(Result.Success());
        public Task<bool> CanAccessClassAsync(Guid classId, CancellationToken ct = default) => Task.FromResult(true);
        public Task<Result> EnsureCanAccessStudentAsync(Guid studentId, CancellationToken ct = default) => Task.FromResult(Result.Success());
    }

    private sealed class TestCurrentUser : ICurrentUser
    {
        public Guid? UserId { get; } = Guid.NewGuid();
        public string? Email => "test@hedu.local";
        public bool IsAuthenticated => true;
        public bool IsInRole(string role) => true;
    }

    private sealed class FakeAccountProvisioning : IAccountProvisioningService
    {
        private static readonly Task<Result> Ok = Task.FromResult(Result.Success());
        public Task<Result<AccountProvisionResultDto>> ProvisionStudentAsync(Guid studentId, ProvisionAccountOptions? options = null, CancellationToken ct = default)
            => Task.FromResult(Result.Success(new AccountProvisionResultDto(Guid.NewGuid(), "x", true)));
        public Task<BulkProvisionResultDto> ProvisionStudentsAsync(IReadOnlyCollection<Guid> studentIds, ProvisionAccountOptions? options = null, CancellationToken ct = default)
            => Task.FromResult(new BulkProvisionResultDto(0, 0, 0, []));
        public Task<Result> ResetStudentPasswordAsync(Guid studentId, string? newPassword = null, CancellationToken ct = default) => Ok;
        public Task<Result> SetStudentLockedAsync(Guid studentId, bool locked, CancellationToken ct = default) => Ok;
        public Task<Result> UnlinkStudentAsync(Guid studentId, CancellationToken ct = default) => Ok;
        public Task<Result> LinkStudentAsync(Guid studentId, Guid userId, CancellationToken ct = default) => Ok;
        public Task<Result<AccountProvisionResultDto>> ProvisionTeacherAsync(Guid teacherProfileId, ProvisionAccountOptions? options = null, CancellationToken ct = default)
            => Task.FromResult(Result.Success(new AccountProvisionResultDto(Guid.NewGuid(), "x", true)));
        public Task<BulkProvisionResultDto> ProvisionTeachersAsync(IReadOnlyCollection<Guid> teacherProfileIds, ProvisionAccountOptions? options = null, CancellationToken ct = default)
            => Task.FromResult(new BulkProvisionResultDto(0, 0, 0, []));
        public Task<Result> ResetTeacherPasswordAsync(Guid teacherProfileId, string? newPassword = null, CancellationToken ct = default) => Ok;
        public Task<Result> SetTeacherLockedAsync(Guid teacherProfileId, bool locked, CancellationToken ct = default) => Ok;
    }

    private sealed class FakeUserDirectory : IUserDirectory
    {
        public Task<bool> ExistsAsync(Guid userId, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> IsInRoleAsync(Guid userId, string role, CancellationToken ct = default) => Task.FromResult(false);
        public Task<Dictionary<Guid, string>> GetDisplayNamesAsync(IEnumerable<Guid> userIds, CancellationToken ct = default) => Task.FromResult(new Dictionary<Guid, string>());
        public Task<Dictionary<Guid, AccountInfo>> GetAccountInfosAsync(IEnumerable<Guid> userIds, CancellationToken ct = default) => Task.FromResult(new Dictionary<Guid, AccountInfo>());
        public Task<List<UserSummary>> GetUsersInRoleAsync(string role, CancellationToken ct = default) => Task.FromResult(new List<UserSummary>());
        public Task<IReadOnlyList<string>> GetRolesAsync(Guid userId, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<string>>([]);
        public Task<Guid?> GetRoleIdAsync(string role, CancellationToken ct = default) => Task.FromResult<Guid?>(null);
    }
}
