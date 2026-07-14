using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Application.Exams;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Exams;
using HungSilver.Infrastructure.Persistence;
using HungSilver.Infrastructure.Persistence.Interceptors;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>
/// Hardening luồng giao đề (2026-07-14): chặn giao trùng khi còn lượt Open chưa quá hạn,
/// chặn giao đề 0 câu, GV chỉ thấy lượt giao của lớp mình trên đề dùng chung,
/// báo cáo gộp HS đã rời lớp (IsActive=false) để số liệu khớp bảng.
/// </summary>
public sealed class ExamAssignHardeningTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;
    private readonly FakeCurrentUser _currentUser = new();

    public ExamAssignHardeningTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection).AddInterceptors(new AuditSaveChangesInterceptor()).Options;
        _context = new AppDbContext(options);
        _context.Database.EnsureCreated();
    }

    public void Dispose() { _context.Dispose(); _connection.Dispose(); }

    private ExamTakingService Taking() => new(_context, _currentUser);
    private ExamAssignmentService Assigning(IClassAccessGuard? guard = null) => new(_context, guard ?? new AdminGuard(), _currentUser);
    private ExamReportService Reporting() => new(_context, new AdminGuard());

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

    /// <summary>Đề 1 câu TrueFalse 10đ.</summary>
    private Guid SeedPublishedExam(bool withQuestion = true)
    {
        var exam = new Exam { Title = "Unit 1 Test", Status = ExamStatus.Published, TotalPoints = 10m, DurationMinutes = 60 };
        _context.Exams.Add(exam);
        _context.SaveChanges();
        if (withQuestion)
        {
            _context.ExamQuestions.Add(new ExamQuestion
            {
                ExamId = exam.Id, OrderNo = 0, Type = ExamQuestionType.TrueFalse, Stem = "Câu 1",
                AnswerJson = "{\"value\":true}", Points = 10m
            });
            _context.SaveChanges();
        }
        return exam.Id;
    }

    private Guid SeedAssignment(Guid examId, Guid classId, DateTime? closeAt = null)
    {
        var a = new ExamAssignment
        {
            ExamId = examId, ExamTitle = "Unit 1 Test", ClassId = classId, Mode = ExamDeliveryMode.InClass,
            DurationMinutes = 60, OpenAt = DateTime.Now.AddHours(-1), CloseAt = closeAt ?? DateTime.Now.AddHours(2),
            TotalPoints = 10m, Status = ExamAssignmentStatus.Open
        };
        _context.ExamAssignments.Add(a);
        _context.SaveChanges();
        return a.Id;
    }

    private static AssignExamRequest InClassRequest(Guid classId) =>
        new(classId, null, ExamDeliveryMode.InClass, 30, DateTime.Now, null);

    // ---- Chặn giao trùng ----

    [Fact]
    public async Task Assign_DuplicateOpen_Rejected()
    {
        var classId = SeedClass();
        var examId = SeedPublishedExam();

        Assert.True((await Assigning().AssignAsync(examId, InClassRequest(classId))).IsSuccess);

        var again = await Assigning().AssignAsync(examId, InClassRequest(classId));
        Assert.True(again.IsFailure);
        Assert.Equal("Exam.AlreadyAssigned", again.Error.Code);
    }

    [Fact]
    public async Task Assign_DuplicateOpen_PastCloseAt_Allowed()
    {
        var classId = SeedClass();
        var examId = SeedPublishedExam();
        // Lượt cũ Open nhưng đã quá hạn nộp ⇒ coi như xong, không bắt GV đóng tay mới giao lại được.
        SeedAssignment(examId, classId, closeAt: DateTime.Now.AddHours(-1));

        Assert.True((await Assigning().AssignAsync(examId, InClassRequest(classId))).IsSuccess);
    }

    [Fact]
    public async Task Assign_SameExam_OtherClass_Allowed()
    {
        var examId = SeedPublishedExam();
        Assert.True((await Assigning().AssignAsync(examId, InClassRequest(SeedClass("Lớp A")))).IsSuccess);
        Assert.True((await Assigning().AssignAsync(examId, InClassRequest(SeedClass("Lớp B")))).IsSuccess);
    }

    // ---- Chặn đề 0 câu ----

    [Fact]
    public async Task Assign_ExamWithoutQuestions_Rejected()
    {
        var classId = SeedClass();
        var examId = SeedPublishedExam(withQuestion: false);

        var result = await Assigning().AssignAsync(examId, InClassRequest(classId));
        Assert.True(result.IsFailure);
        Assert.Equal("Exam.NoQuestions", result.Error.Code);
    }

    // ---- GV chỉ thấy lượt giao của lớp mình ----

    [Fact]
    public async Task ListByExam_TeacherSeesOnlyOwnedClasses_AdminSeesAll()
    {
        var examId = SeedPublishedExam();
        var myClassId = SeedClass("Lớp của tôi");
        var otherClassId = SeedClass("Lớp GV khác");
        var mine = SeedAssignment(examId, myClassId);
        SeedAssignment(examId, otherClassId);

        var teacherList = (await Assigning(new TeacherGuard([myClassId])).ListByExamAsync(examId)).Value;
        var only = Assert.Single(teacherList);
        Assert.Equal(mine, only.Id);

        var adminList = (await Assigning().ListByExamAsync(examId)).Value;
        Assert.Equal(2, adminList.Count);
    }

    // ---- Báo cáo gộp HS đã rời lớp ----

    [Fact]
    public async Task Report_WithdrawnStudentWithAttempt_IncludedWithConsistentTotals()
    {
        var classId = SeedClass();
        var examId = SeedPublishedExam();
        var assignmentId = SeedAssignment(examId, classId);

        var uA = Guid.NewGuid(); var studentA = SeedStudent(uA, classId, "An");
        SeedStudent(Guid.NewGuid(), classId, "Bình"); // chưa làm, còn học

        _currentUser.UserId = uA;
        var svc = Taking();
        var attempt = (await svc.StartAsync(assignmentId)).Value;
        Assert.True((await svc.SaveAnswerAsync(attempt.AttemptId, new SaveExamAnswerRequest(attempt.Questions[0].Id, "{\"value\":true}"))).IsSuccess);
        Assert.True((await svc.SubmitAsync(attempt.AttemptId)).IsSuccess); // 10đ

        // An rời lớp sau khi nộp.
        var enrollment = await _context.Enrollments.FirstAsync(e => e.StudentId == studentA && e.ClassId == classId);
        enrollment.IsActive = false;
        await _context.SaveChangesAsync();

        var report = (await Reporting().GetReportAsync(assignmentId)).Value;

        Assert.Equal(2, report.TotalStudents);   // Bình (đang học) + An (đã rời, có bài)
        Assert.Equal(1, report.SubmittedCount);
        Assert.Equal(10m, report.AverageScore);
        var an = Assert.Single(report.Students, s => s.FullName == "An");
        Assert.False(an.IsActive);
        Assert.Equal(10m, an.Score);
        var binh = Assert.Single(report.Students, s => s.FullName == "Bình");
        Assert.True(binh.IsActive);
        Assert.Null(binh.Status);
    }

    // ---- Fakes ----

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
