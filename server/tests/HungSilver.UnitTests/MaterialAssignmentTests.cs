using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Application.Materials;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Exams;
using HungSilver.Infrastructure.Materials;
using HungSilver.Infrastructure.Persistence;
using HungSilver.Infrastructure.Persistence.Interceptors;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>
/// Giao tài liệu cho lớp (2026-07-16): chặn giao trùng, thu hồi rồi giao lại được, guard lớp,
/// portal chỉ thấy lớp đang học + ẩn tài liệu đã xóa, đánh dấu đã xem idempotent,
/// viewers đếm HS active + gộp HS đã rời lớp từng xem. Kèm ExamAssignmentService.ListByClassAsync.
/// </summary>
public sealed class MaterialAssignmentTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;
    private readonly FakeCurrentUser _currentUser = new();

    public MaterialAssignmentTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection).AddInterceptors(new AuditSaveChangesInterceptor()).Options;
        _context = new AppDbContext(options);
        _context.Database.EnsureCreated();
    }

    public void Dispose() { _context.Dispose(); _connection.Dispose(); }

    private MaterialAssignmentService Assigning(IClassAccessGuard? guard = null) => new(_context, guard ?? new AdminGuard(), _currentUser);
    private PortalMaterialService Portal() => new(_context, _currentUser);

    // ---- Seed helpers ----

    private Guid SeedClass(string name = "Lớp A")
    {
        var c = new ClassRoom { Name = name, TeacherId = Guid.NewGuid(), MaxCapacity = 30 };
        _context.Classes.Add(c);
        _context.SaveChanges();
        return c.Id;
    }

    private Guid SeedStudent(Guid userId, Guid classId, string name = "Nguyễn A")
    {
        var s = new Student { StudentCode = "HS" + Guid.NewGuid().ToString("N")[..4], FullName = name, UserId = userId, IsActive = true };
        _context.Students.Add(s);
        _context.SaveChanges();
        _context.Enrollments.Add(new Enrollment { StudentId = s.Id, ClassId = classId, EnrolledOn = DateOnly.FromDateTime(DateTime.Now), IsActive = true });
        _context.SaveChanges();
        return s.Id;
    }

    private Guid SeedMaterial(string title = "Unit 1 Grammar", MaterialSource source = MaterialSource.ExternalUrl)
    {
        var m = new LearningMaterial
        {
            Code = "TL" + Guid.NewGuid().ToString("N")[..4],
            Title = title,
            Source = source,
            Url = source == MaterialSource.ExternalUrl ? "https://example.com/doc" : null
        };
        if (source == MaterialSource.ServerFile)
        {
            var f = new StoredFile { FileName = "unit1.pdf", ContentType = "application/pdf", StoragePath = "x", Sha256 = "s" };
            _context.StoredFiles.Add(f);
            _context.SaveChanges();
            m.StoredFileId = f.Id;
        }
        _context.LearningMaterials.Add(m);
        _context.SaveChanges();
        return m.Id;
    }

    private Guid SeedSession(Guid classId)
    {
        var s = new ClassSession { ClassId = classId, SessionNumber = 1, SessionDate = DateOnly.FromDateTime(DateTime.Now), Status = SessionStatus.Scheduled };
        _context.ClassSessions.Add(s);
        _context.SaveChanges();
        return s.Id;
    }

    // ---- Giao + chặn trùng + thu hồi ----

    [Fact]
    public async Task Assign_Ok_ThenDuplicate_Conflict()
    {
        var classId = SeedClass();
        SeedStudent(Guid.NewGuid(), classId);
        var materialId = SeedMaterial(source: MaterialSource.ServerFile);

        var first = await Assigning().AssignAsync(materialId, new AssignMaterialRequest(classId, null, "  Đọc trước Unit 1  "));
        Assert.True(first.IsSuccess);
        Assert.Equal("Unit 1 Grammar", first.Value.MaterialTitle);
        Assert.False(first.Value.MaterialDeleted);
        Assert.Equal("Đọc trước Unit 1", first.Value.Note); // trim
        Assert.Equal("unit1.pdf", first.Value.FileName);    // resolve StoredFile
        Assert.Equal(0, first.Value.ViewedCount);
        Assert.Equal(1, first.Value.TotalStudents);

        var again = await Assigning().AssignAsync(materialId, new AssignMaterialRequest(classId, null, null));
        Assert.True(again.IsFailure);
        Assert.Equal("Material.AlreadyAssigned", again.Error.Code);

        // Cùng tài liệu giao lớp khác vẫn được.
        Assert.True((await Assigning().AssignAsync(materialId, new AssignMaterialRequest(SeedClass("Lớp B"), null, null))).IsSuccess);
    }

    [Fact]
    public async Task Assign_AfterRemove_Allowed()
    {
        var classId = SeedClass();
        var materialId = SeedMaterial();

        var first = (await Assigning().AssignAsync(materialId, new AssignMaterialRequest(classId, null, null))).Value;
        Assert.True((await Assigning().RemoveAsync(first.Id)).IsSuccess);

        var list = (await Assigning().ListByClassAsync(classId)).Value;
        Assert.Empty(list);

        Assert.True((await Assigning().AssignAsync(materialId, new AssignMaterialRequest(classId, null, null))).IsSuccess);
    }

    [Fact]
    public async Task Assign_MaterialMissingOrSoftDeleted_NotFound()
    {
        var classId = SeedClass();

        var missing = await Assigning().AssignAsync(Guid.NewGuid(), new AssignMaterialRequest(classId, null, null));
        Assert.True(missing.IsFailure);
        Assert.Equal("Material.NotFound", missing.Error.Code);

        var materialId = SeedMaterial();
        var material = await _context.LearningMaterials.FirstAsync(m => m.Id == materialId);
        _context.LearningMaterials.Remove(material); // interceptor → soft delete
        await _context.SaveChangesAsync();

        var deleted = await Assigning().AssignAsync(materialId, new AssignMaterialRequest(classId, null, null));
        Assert.True(deleted.IsFailure);
        Assert.Equal("Material.NotFound", deleted.Error.Code);
    }

    [Fact]
    public async Task Assign_SessionOfOtherClass_Rejected()
    {
        var classId = SeedClass();
        var otherSessionId = SeedSession(SeedClass("Lớp B"));
        var materialId = SeedMaterial();

        var result = await Assigning().AssignAsync(materialId, new AssignMaterialRequest(classId, otherSessionId, null));
        Assert.True(result.IsFailure);
        Assert.Equal("Material.SessionClassMismatch", result.Error.Code);
    }

    [Fact]
    public async Task Assign_TeacherWithoutClassAccess_NotFound()
    {
        var classId = SeedClass();
        var materialId = SeedMaterial();

        var result = await Assigning(new TeacherGuard([])).AssignAsync(materialId, new AssignMaterialRequest(classId, null, null));
        Assert.True(result.IsFailure);
        Assert.Equal("Class.NotFound", result.Error.Code);
    }

    [Fact]
    public async Task ListBySession_ReturnsOnlySessionAssignments()
    {
        var classId = SeedClass();
        var sessionId = SeedSession(classId);
        var withSession = (await Assigning().AssignAsync(SeedMaterial("TL buổi"), new AssignMaterialRequest(classId, sessionId, null))).Value;
        await Assigning().AssignAsync(SeedMaterial("TL lớp"), new AssignMaterialRequest(classId, null, null));

        var bySession = (await Assigning().ListBySessionAsync(sessionId)).Value;
        var only = Assert.Single(bySession);
        Assert.Equal(withSession.Id, only.Id);

        var byClass = (await Assigning().ListByClassAsync(classId)).Value;
        Assert.Equal(2, byClass.Count);
    }

    // ---- Portal học viên ----

    [Fact]
    public async Task PortalMaterials_OnlyActiveEnrollment_And_HidesDeletedMaterial()
    {
        var myClassId = SeedClass("Lớp của tôi");
        var otherClassId = SeedClass("Lớp khác");
        var userId = Guid.NewGuid();
        SeedStudent(userId, myClassId);

        var visibleId = SeedMaterial("Thấy được");
        var deletedId = SeedMaterial("Sẽ bị xóa");
        await Assigning().AssignAsync(visibleId, new AssignMaterialRequest(myClassId, null, "Ghi chú"));
        await Assigning().AssignAsync(deletedId, new AssignMaterialRequest(myClassId, null, null));
        await Assigning().AssignAsync(SeedMaterial("Lớp khác"), new AssignMaterialRequest(otherClassId, null, null));

        var material = await _context.LearningMaterials.FirstAsync(m => m.Id == deletedId);
        _context.LearningMaterials.Remove(material);
        await _context.SaveChangesAsync();

        _currentUser.UserId = userId;
        var mine = (await Portal().GetMyMaterialsAsync()).Value;
        var only = Assert.Single(mine);
        Assert.Equal("Thấy được", only.Title);
        Assert.Equal("Ghi chú", only.Note);
        Assert.False(only.Viewed);
    }

    [Fact]
    public async Task MarkViewed_Idempotent_And_ForbiddenOutsideClass()
    {
        var classId = SeedClass();
        var userId = Guid.NewGuid();
        SeedStudent(userId, classId);
        var assignment = (await Assigning().AssignAsync(SeedMaterial(), new AssignMaterialRequest(classId, null, null))).Value;

        _currentUser.UserId = userId;
        Assert.True((await Portal().MarkViewedAsync(assignment.Id)).IsSuccess);
        Assert.True((await Portal().MarkViewedAsync(assignment.Id)).IsSuccess); // idempotent
        Assert.Equal(1, await _context.MaterialAssignmentViews.CountAsync());

        var mine = (await Portal().GetMyMaterialsAsync()).Value;
        Assert.True(Assert.Single(mine).Viewed);

        // HS lớp khác không đánh dấu được.
        var outsiderUserId = Guid.NewGuid();
        SeedStudent(outsiderUserId, SeedClass("Lớp B"), "Người ngoài");
        _currentUser.UserId = outsiderUserId;
        var forbidden = await Portal().MarkViewedAsync(assignment.Id);
        Assert.True(forbidden.IsFailure);
        Assert.Equal("Material.NotInClass", forbidden.Error.Code);
    }

    // ---- Viewers + đếm x/y ----

    [Fact]
    public async Task Viewers_CountsActiveOnly_And_KeepsFormerViewer()
    {
        var classId = SeedClass();
        var userA = Guid.NewGuid(); var studentA = SeedStudent(userA, classId, "An");
        SeedStudent(Guid.NewGuid(), classId, "Bình"); // chưa xem, còn học
        var assignment = (await Assigning().AssignAsync(SeedMaterial(), new AssignMaterialRequest(classId, null, null))).Value;

        _currentUser.UserId = userA;
        Assert.True((await Portal().MarkViewedAsync(assignment.Id)).IsSuccess);

        var before = (await Assigning().ListByClassAsync(classId)).Value;
        Assert.Equal(1, Assert.Single(before).ViewedCount);
        Assert.Equal(2, Assert.Single(before).TotalStudents);

        // An rời lớp sau khi xem: x/y chỉ đếm HS active, nhưng danh sách viewers vẫn giữ An (IsActive=false).
        var enrollment = await _context.Enrollments.FirstAsync(e => e.StudentId == studentA && e.ClassId == classId);
        enrollment.IsActive = false;
        await _context.SaveChangesAsync();

        var after = (await Assigning().ListByClassAsync(classId)).Value;
        Assert.Equal(0, Assert.Single(after).ViewedCount);
        Assert.Equal(1, Assert.Single(after).TotalStudents);

        var viewers = (await Assigning().GetViewersAsync(assignment.Id)).Value;
        Assert.Equal(2, viewers.Count);
        var an = Assert.Single(viewers, v => v.FullName == "An");
        Assert.False(an.IsActive);
        Assert.NotNull(an.ViewedAt);
        var binh = Assert.Single(viewers, v => v.FullName == "Bình");
        Assert.True(binh.IsActive);
        Assert.Null(binh.ViewedAt);
    }

    // ---- ExamAssignmentService.ListByClassAsync (bổ sung cho trang chi tiết lớp) ----

    [Fact]
    public async Task ExamAssignments_ListByClass_ReturnsOnlyClassAssignments_WithGuard()
    {
        var classId = SeedClass();
        var otherClassId = SeedClass("Lớp B");
        var exam = new Exam { Title = "Đề 1", Status = ExamStatus.Published, TotalPoints = 10m, DurationMinutes = 60 };
        _context.Exams.Add(exam);
        _context.SaveChanges();
        _context.ExamAssignments.AddRange(
            new ExamAssignment { ExamId = exam.Id, ExamTitle = "Đề 1", ClassId = classId, Mode = ExamDeliveryMode.InClass, DurationMinutes = 60, OpenAt = DateTime.Now, TotalPoints = 10m, Status = ExamAssignmentStatus.Open },
            new ExamAssignment { ExamId = exam.Id, ExamTitle = "Đề 1", ClassId = otherClassId, Mode = ExamDeliveryMode.InClass, DurationMinutes = 60, OpenAt = DateTime.Now, TotalPoints = 10m, Status = ExamAssignmentStatus.Open });
        _context.SaveChanges();

        var svc = new ExamAssignmentService(_context, new AdminGuard(), _currentUser);
        var list = (await svc.ListByClassAsync(classId)).Value;
        Assert.Equal(classId, Assert.Single(list).ClassId);

        var guarded = new ExamAssignmentService(_context, new TeacherGuard([]), _currentUser);
        Assert.True((await guarded.ListByClassAsync(classId)).IsFailure);
    }

    // ---- Fakes (mirror ExamAssignHardeningTests — private per-file theo hiện trạng test suite) ----

    private sealed class FakeCurrentUser : ICurrentUser
    {
        public Guid? UserId { get; set; }
        public string? Email => "hs@hs.local";
        public bool IsAuthenticated => UserId is not null;
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

    /// <summary>GV không phải admin, phụ trách đúng danh sách lớp cho trước.</summary>
    private sealed class TeacherGuard(List<Guid> ownedClassIds) : IClassAccessGuard
    {
        private readonly Guid _scopeId = Guid.NewGuid();
        public bool IsAdmin => false;
        public Task<Guid?> GetTeacherScopeIdAsync(CancellationToken ct = default) => Task.FromResult<Guid?>(_scopeId);
        public Task<List<Guid>> GetOwnedClassIdsAsync(CancellationToken ct = default) => Task.FromResult(ownedClassIds);
        public Task<Result> EnsureCanAccessClassAsync(Guid classId, CancellationToken ct = default) =>
            Task.FromResult(ownedClassIds.Contains(classId)
                ? Result.Success()
                : Result.Failure(Error.NotFound("Class.NotFound", "Không tìm thấy lớp học.")));
        public Task<bool> CanAccessClassAsync(Guid classId, CancellationToken ct = default) => Task.FromResult(ownedClassIds.Contains(classId));
        public Task<Result> EnsureCanAccessStudentAsync(Guid studentId, CancellationToken ct = default) => Task.FromResult(Result.Success());
    }
}
