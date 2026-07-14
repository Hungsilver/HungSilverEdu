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
/// Bài về nhà KHÔNG giới hạn thời gian làm (DurationMinutes = null): chỉ Homework + bắt buộc CloseAt;
/// HS không có đồng hồ (ExpiresAt null), mốc chốt duy nhất là hạn nộp — quá CloseAt+grace thì
/// SaveAnswer bị chặn và Submit thành AutoSubmitted.
/// </summary>
public sealed class ExamUnlimitedHomeworkTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;
    private readonly FakeCurrentUser _currentUser = new();

    public ExamUnlimitedHomeworkTests()
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
    private ExamAssignmentService Assigning() => new(_context, new AdminGuard(), _currentUser);

    // ---- Seed helpers ----

    private Guid SeedClass()
    {
        var c = new ClassRoom { Name = "Lớp A", TeacherId = Guid.NewGuid(), MaxCapacity = 30 };
        _context.Classes.Add(c);
        _context.SaveChanges();
        return c.Id;
    }

    private Guid SeedStudent(Guid userId, Guid classId)
    {
        var s = new Student { StudentCode = "HS" + Guid.NewGuid().ToString("N")[..4], FullName = "Nguyễn A", UserId = userId, IsActive = true };
        _context.Students.Add(s);
        _context.SaveChanges();
        _context.Enrollments.Add(new Enrollment { StudentId = s.Id, ClassId = classId, EnrolledOn = DateOnly.FromDateTime(DateTime.Now), IsActive = true });
        _context.SaveChanges();
        return s.Id;
    }

    private Guid SeedPublishedExam()
    {
        var exam = new Exam { Title = "BTVN Unit 3", Status = ExamStatus.Published, TotalPoints = 10m, DurationMinutes = 60 };
        _context.Exams.Add(exam);
        _context.SaveChanges();
        _context.ExamQuestions.Add(new ExamQuestion
        {
            ExamId = exam.Id, OrderNo = 0, Type = ExamQuestionType.TrueFalse, Stem = "Câu 1",
            AnswerJson = "{\"value\":true}", Points = 10m
        });
        _context.SaveChanges();
        return exam.Id;
    }

    /// <summary>Lượt giao không giới hạn giờ làm (Homework, DurationMinutes = null) — seed thẳng DB.</summary>
    private ExamAssignment SeedUnlimitedAssignment(Guid examId, Guid classId, DateTime? closeAt = null)
    {
        var a = new ExamAssignment
        {
            ExamId = examId, ExamTitle = "BTVN Unit 3", ClassId = classId, Mode = ExamDeliveryMode.Homework,
            DurationMinutes = null, OpenAt = DateTime.Now.AddHours(-1), CloseAt = closeAt ?? DateTime.Now.AddDays(2),
            TotalPoints = 10m, Status = ExamAssignmentStatus.Open
        };
        _context.ExamAssignments.Add(a);
        _context.SaveChanges();
        return a;
    }

    // ---- Giao đề: validate NoTimeLimit ----

    [Fact]
    public async Task Assign_NoTimeLimit_RejectsInClass()
    {
        var classId = SeedClass();
        var examId = SeedPublishedExam();

        var result = await Assigning().AssignAsync(examId, new AssignExamRequest(
            classId, null, ExamDeliveryMode.InClass, null, DateTime.Now, DateTime.Now.AddDays(1), NoTimeLimit: true));

        Assert.True(result.IsFailure);
        Assert.Equal("Exam.NoTimeLimitOnlyHomework", result.Error.Code);
    }

    [Fact]
    public async Task Assign_NoTimeLimit_RequiresCloseAt()
    {
        var classId = SeedClass();
        var examId = SeedPublishedExam();

        var result = await Assigning().AssignAsync(examId, new AssignExamRequest(
            classId, null, ExamDeliveryMode.Homework, null, DateTime.Now, null, NoTimeLimit: true));

        Assert.True(result.IsFailure);
        Assert.Equal("Exam.CloseAtRequired", result.Error.Code);
    }

    [Fact]
    public async Task Assign_NoTimeLimit_Succeeds_DurationNull()
    {
        var classId = SeedClass();
        var examId = SeedPublishedExam();

        var result = await Assigning().AssignAsync(examId, new AssignExamRequest(
            classId, null, ExamDeliveryMode.Homework, null, DateTime.Now, DateTime.Now.AddDays(2), NoTimeLimit: true));

        Assert.True(result.IsSuccess);
        Assert.Null(result.Value.DurationMinutes);
        Assert.NotNull(result.Value.CloseAt);
        Assert.Null((await _context.ExamAssignments.FirstAsync(a => a.Id == result.Value.Id)).DurationMinutes);
    }

    [Fact]
    public async Task Assign_CloseBeforeOpen_Rejected()
    {
        var classId = SeedClass();
        var examId = SeedPublishedExam();

        var result = await Assigning().AssignAsync(examId, new AssignExamRequest(
            classId, null, ExamDeliveryMode.Homework, 30, DateTime.Now, DateTime.Now.AddMinutes(-10)));

        Assert.True(result.IsFailure);
        Assert.Equal("Exam.CloseBeforeOpen", result.Error.Code);
    }

    [Fact]
    public async Task Assign_WithoutNoTimeLimit_KeepsSnapshotBehavior()
    {
        var classId = SeedClass();
        var examId = SeedPublishedExam();

        // Không truyền duration ⇒ snapshot từ đề (60') như trước — regression cho luồng cũ.
        var result = await Assigning().AssignAsync(examId, new AssignExamRequest(
            classId, null, ExamDeliveryMode.InClass, null, DateTime.Now, null));

        Assert.True(result.IsSuccess);
        Assert.Equal(60, result.Value.DurationMinutes);
    }

    // ---- HS làm bài không giới hạn ----

    [Fact]
    public async Task Start_Unlimited_ExpiresAtNull_CloseAtReturned()
    {
        var classId = SeedClass();
        var examId = SeedPublishedExam();
        var userId = Guid.NewGuid();
        SeedStudent(userId, classId);
        var assignment = SeedUnlimitedAssignment(examId, classId);
        _currentUser.UserId = userId;

        var start = await Taking().StartAsync(assignment.Id);

        Assert.True(start.IsSuccess);
        Assert.Null(start.Value.DurationMinutes);
        Assert.Null(start.Value.ExpiresAt);
        Assert.Equal(assignment.CloseAt, start.Value.CloseAt);
    }

    [Fact]
    public async Task SaveAndSubmit_Unlimited_LongAfterStart_StillSubmitted()
    {
        var classId = SeedClass();
        var examId = SeedPublishedExam();
        var userId = Guid.NewGuid();
        SeedStudent(userId, classId);
        var assignment = SeedUnlimitedAssignment(examId, classId);
        _currentUser.UserId = userId;
        var svc = Taking();

        var attempt = (await svc.StartAsync(assignment.Id)).Value;
        // Mô phỏng HS làm rải rác 5 tiếng (bài có giờ đã TimeUp từ lâu) — không giới hạn vẫn lưu/nộp bình thường.
        var att = await _context.ExamAttempts.FirstAsync(a => a.Id == attempt.AttemptId);
        att.StartedAt = DateTime.Now.AddHours(-5);
        await _context.SaveChangesAsync();

        var q = attempt.Questions.Single();
        Assert.True((await svc.SaveAnswerAsync(attempt.AttemptId, new SaveExamAnswerRequest(q.Id, "{\"value\":true}"))).IsSuccess);

        var submit = await svc.SubmitAsync(attempt.AttemptId);
        Assert.True(submit.IsSuccess);
        Assert.Equal(ExamAttemptStatus.Submitted, submit.Value.Status);
        Assert.Equal(10m, submit.Value.Score);
    }

    [Fact]
    public async Task SaveAnswer_Unlimited_PastCloseAtGrace_TimeUp()
    {
        var (svc, attempt, assignmentId) = await StartUnlimitedAttemptAsync();
        await MoveCloseAtToPastAsync(assignmentId);

        var q = attempt.Questions.Single();
        var save = await svc.SaveAnswerAsync(attempt.AttemptId, new SaveExamAnswerRequest(q.Id, "{\"value\":true}"));

        Assert.True(save.IsFailure);
        Assert.Equal("Exam.TimeUp", save.Error.Code);
    }

    [Fact]
    public async Task Submit_Unlimited_AfterCloseAtGrace_IsAutoSubmitted()
    {
        var (svc, attempt, assignmentId) = await StartUnlimitedAttemptAsync();
        await MoveCloseAtToPastAsync(assignmentId);

        var submit = await svc.SubmitAsync(attempt.AttemptId);

        Assert.True(submit.IsSuccess);
        Assert.Equal(ExamAttemptStatus.AutoSubmitted, submit.Value.Status);
    }

    [Fact]
    public async Task SaveAnswer_Unlimited_AssignmentClosedByTeacher_Rejected()
    {
        var (svc, attempt, assignmentId) = await StartUnlimitedAttemptAsync();
        var asg = await _context.ExamAssignments.FirstAsync(a => a.Id == assignmentId);
        asg.Status = ExamAssignmentStatus.Closed;
        await _context.SaveChangesAsync();

        var q = attempt.Questions.Single();
        var save = await svc.SaveAnswerAsync(attempt.AttemptId, new SaveExamAnswerRequest(q.Id, "{\"value\":true}"));

        Assert.True(save.IsFailure);
        Assert.Equal("Exam.Closed", save.Error.Code);
    }

    // ---- Helpers ----

    private async Task<(ExamTakingService svc, PortalAttemptDto attempt, Guid assignmentId)> StartUnlimitedAttemptAsync()
    {
        var classId = SeedClass();
        var examId = SeedPublishedExam();
        var userId = Guid.NewGuid();
        SeedStudent(userId, classId);
        var assignment = SeedUnlimitedAssignment(examId, classId);
        _currentUser.UserId = userId;
        var svc = Taking();
        var attempt = (await svc.StartAsync(assignment.Id)).Value;
        return (svc, attempt, assignment.Id);
    }

    private async Task MoveCloseAtToPastAsync(Guid assignmentId)
    {
        var asg = await _context.ExamAssignments.FirstAsync(a => a.Id == assignmentId);
        asg.CloseAt = DateTime.Now.AddMinutes(-5); // quá hạn nộp + grace
        await _context.SaveChangesAsync();
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
}
