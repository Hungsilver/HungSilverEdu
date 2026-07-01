using System.Text.Json;
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
/// Mô phỏng dữ liệu thực: GV giao đề → HS làm (4 loại câu) → nộp → TỰ CHẤM đúng điểm → xem lại → báo cáo lớp.
/// Kiểm cả server-authoritative (hết giờ tự nộp), 1 lượt/HS, và KHÔNG lộ đáp án khi đang làm.
/// </summary>
public sealed class ExamDeliveryFlowTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;
    private readonly FakeCurrentUser _currentUser = new();

    public ExamDeliveryFlowTests()
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

    /// <summary>Đề 4 câu, mỗi câu 2.5đ (tổng 10), 1 câu mỗi loại.</summary>
    private Guid SeedPublishedExam()
    {
        var exam = new Exam { Title = "Unit 3 Test", Status = ExamStatus.Published, TotalPoints = 10m, DurationMinutes = 60 };
        _context.Exams.Add(exam);
        _context.SaveChanges();

        void Q(int order, ExamQuestionType type, string? opts, string answer) =>
            _context.ExamQuestions.Add(new ExamQuestion
            {
                ExamId = exam.Id, OrderNo = order, Type = type, Stem = $"Câu {order + 1}",
                OptionsJson = opts, AnswerJson = answer, Explanation = "vì vậy", Points = 2.5m
            });

        Q(0, ExamQuestionType.SingleChoice, "[{\"key\":\"A\",\"text\":\"a\"},{\"key\":\"B\",\"text\":\"b\"}]", "{\"key\":\"B\"}");
        Q(1, ExamQuestionType.TrueFalse, null, "{\"value\":true}");
        Q(2, ExamQuestionType.FillBlank, "{\"blanks\":1}", "{\"blanks\":[[\"mental\"]]}");
        Q(3, ExamQuestionType.Matching,
            "{\"left\":[{\"key\":\"1\",\"text\":\"x\"},{\"key\":\"2\",\"text\":\"y\"}],\"right\":[{\"key\":\"a\",\"text\":\"p\"},{\"key\":\"b\",\"text\":\"q\"}]}",
            "{\"pairs\":{\"1\":\"a\",\"2\":\"b\"}}");
        _context.SaveChanges();
        return exam.Id;
    }

    private Guid SeedAssignment(Guid examId, Guid classId, int duration = 60, DateTime? openAt = null, DateTime? closeAt = null)
    {
        var a = new ExamAssignment
        {
            ExamId = examId, ExamTitle = "Unit 3 Test", ClassId = classId, Mode = ExamDeliveryMode.InClass,
            DurationMinutes = duration, OpenAt = openAt ?? DateTime.Now.AddMinutes(-1), CloseAt = closeAt ?? DateTime.Now.AddHours(2),
            TotalPoints = 10m, Status = ExamAssignmentStatus.Open
        };
        _context.ExamAssignments.Add(a);
        _context.SaveChanges();
        return a.Id;
    }

    private async Task AnswerAllAsync(ExamTakingService svc, Guid attemptId, PortalAttemptDto attempt)
    {
        foreach (var q in attempt.Questions)
        {
            var resp = q.Type switch
            {
                ExamQuestionType.SingleChoice => "{\"key\":\"B\"}",              // đúng
                ExamQuestionType.TrueFalse => "{\"value\":false}",               // SAI
                ExamQuestionType.FillBlank => "{\"blanks\":[\"MENTAL\"]}",       // đúng (chuẩn hóa)
                ExamQuestionType.Matching => "{\"pairs\":{\"1\":\"a\",\"2\":\"c\"}}", // 1/2 đúng
                _ => "{}"
            };
            var r = await svc.SaveAnswerAsync(attemptId, new SaveExamAnswerRequest(q.Id, resp));
            Assert.True(r.IsSuccess);
        }
    }

    // ---- Tests ----

    [Fact]
    public async Task Assign_RequiresPublishedExam()
    {
        var classId = SeedClass();
        var draft = new Exam { Title = "Nháp", Status = ExamStatus.Draft, TotalPoints = 10m };
        _context.Exams.Add(draft);
        await _context.SaveChangesAsync();

        var result = await Assigning().AssignAsync(draft.Id,
            new AssignExamRequest(classId, null, ExamDeliveryMode.InClass, 45, DateTime.Now, null));

        Assert.True(result.IsFailure);
        Assert.Equal("Exam.NotPublished", result.Error.Code);
    }

    [Fact]
    public async Task FullFlow_TakeSubmitGradeReview_ScoresCorrectly()
    {
        var classId = SeedClass();
        var examId = SeedPublishedExam();
        var userId = Guid.NewGuid();
        SeedStudent(userId, classId);
        var assignmentId = SeedAssignment(examId, classId);
        _currentUser.UserId = userId;

        var svc = Taking();

        // Bắt đầu: KHÔNG lộ đáp án (PortalQuestionDto không có trường answer — kiểm cấu trúc).
        var start = await svc.StartAsync(assignmentId);
        Assert.True(start.IsSuccess);
        var attempt = start.Value;
        Assert.Equal(4, attempt.Questions.Count);
        Assert.True(attempt.ExpiresAt > DateTime.Now);

        await AnswerAllAsync(svc, attempt.AttemptId, attempt);

        var submit = await svc.SubmitAsync(attempt.AttemptId);
        Assert.True(submit.IsSuccess);
        // 2.5 (đúng) + 0 (sai) + 2.5 (đúng) + 1.25 (nối 1/2) = 6.25
        Assert.Equal(6.25m, submit.Value.Score);
        Assert.Equal(2, submit.Value.CorrectCount);
        Assert.Equal(4, submit.Value.TotalCount);
        Assert.Equal(ExamAttemptStatus.Submitted, submit.Value.Status);

        // Xem lại: có đáp án + giải thích + đúng/sai từng câu.
        var review = await svc.GetReviewAsync(attempt.AttemptId);
        Assert.True(review.IsSuccess);
        Assert.Equal(4, review.Value.Questions.Count);
        Assert.All(review.Value.Questions, q => Assert.False(string.IsNullOrWhiteSpace(q.AnswerJson)));
        Assert.Contains(review.Value.Questions, q => q.IsCorrect == true);
        Assert.Contains(review.Value.Questions, q => q.IsCorrect == false);
    }

    [Fact]
    public async Task Submit_AfterExpiry_IsAutoSubmitted()
    {
        var classId = SeedClass();
        var examId = SeedPublishedExam();
        var userId = Guid.NewGuid();
        SeedStudent(userId, classId);
        var assignmentId = SeedAssignment(examId, classId, duration: 30);
        _currentUser.UserId = userId;

        var svc = Taking();
        var start = await svc.StartAsync(assignmentId);
        var attemptId = start.Value.AttemptId;

        // Ép StartedAt lùi quá hạn (mô phỏng hết giờ).
        var att = await _context.ExamAttempts.FirstAsync(a => a.Id == attemptId);
        att.StartedAt = DateTime.Now.AddMinutes(-90);
        await _context.SaveChangesAsync();

        var submit = await svc.SubmitAsync(attemptId);
        Assert.True(submit.IsSuccess);
        Assert.Equal(ExamAttemptStatus.AutoSubmitted, submit.Value.Status);
    }

    [Fact]
    public async Task Guards_OneAttempt_NoResubmit_NotInClass()
    {
        var classId = SeedClass();
        var examId = SeedPublishedExam();
        var userId = Guid.NewGuid();
        SeedStudent(userId, classId);
        var assignmentId = SeedAssignment(examId, classId);
        _currentUser.UserId = userId;
        var svc = Taking();

        var a1 = (await svc.StartAsync(assignmentId)).Value;
        var a2 = (await svc.StartAsync(assignmentId)).Value;
        Assert.Equal(a1.AttemptId, a2.AttemptId); // resume, không tạo lượt mới

        Assert.True((await svc.SubmitAsync(a1.AttemptId)).IsSuccess);
        // Đã nộp: start lại + save đều bị chặn.
        Assert.True((await svc.StartAsync(assignmentId)).IsFailure);
        Assert.Equal("Exam.AlreadySubmitted", (await svc.StartAsync(assignmentId)).Error.Code);
        var save = await svc.SaveAnswerAsync(a1.AttemptId, new SaveExamAnswerRequest(Guid.NewGuid(), "{}"));
        Assert.True(save.IsFailure);

        // HS không thuộc lớp ⇒ Forbidden.
        var outsiderClass = SeedClass("Lớp B");
        var outsiderUser = Guid.NewGuid();
        SeedStudent(outsiderUser, outsiderClass, "Trần B");
        _currentUser.UserId = outsiderUser;
        var forbidden = await Taking().StartAsync(assignmentId);
        Assert.True(forbidden.IsFailure);
        Assert.Equal("Exam.NotInClass", forbidden.Error.Code);
    }

    [Fact]
    public async Task Review_BeforeSubmit_IsRejected()
    {
        var classId = SeedClass();
        var examId = SeedPublishedExam();
        var userId = Guid.NewGuid();
        SeedStudent(userId, classId);
        var assignmentId = SeedAssignment(examId, classId);
        _currentUser.UserId = userId;
        var svc = Taking();

        var attemptId = (await svc.StartAsync(assignmentId)).Value.AttemptId;
        var review = await svc.GetReviewAsync(attemptId);
        Assert.True(review.IsFailure);
        Assert.Equal("Exam.NotSubmitted", review.Error.Code);
    }

    [Fact]
    public async Task Report_Aggregates_Distribution_ItemStats_Students()
    {
        var classId = SeedClass();
        var examId = SeedPublishedExam();
        var assignmentId = SeedAssignment(examId, classId);

        // 2 HS nộp (điểm 6.25 & 0), 1 HS chưa làm.
        var uA = Guid.NewGuid(); SeedStudent(uA, classId, "An");
        var uB = Guid.NewGuid(); SeedStudent(uB, classId, "Bình");
        SeedStudent(Guid.NewGuid(), classId, "Chưa làm");

        _currentUser.UserId = uA;
        var sa = Taking(); var a = (await sa.StartAsync(assignmentId)).Value;
        await AnswerAllAsync(sa, a.AttemptId, a);
        await sa.SubmitAsync(a.AttemptId); // 6.25

        _currentUser.UserId = uB;
        var sb = Taking(); var b = (await sb.StartAsync(assignmentId)).Value;
        // B không trả lời gì ⇒ 0 điểm.
        await sb.SubmitAsync(b.AttemptId);

        var report = (await Reporting().GetReportAsync(assignmentId)).Value;

        Assert.Equal(3, report.TotalStudents);
        Assert.Equal(2, report.SubmittedCount);
        Assert.Equal(3.13m, report.AverageScore); // (6.25 + 0)/2 = 3.125 → round 3.13
        Assert.Equal(5, report.Distribution.Count);
        Assert.Equal(1, report.Distribution[0].Count);           // "0–2": B (0đ)
        Assert.Equal(1, report.Distribution[3].Count);           // "6–8": A (6.25)
        Assert.Equal(4, report.ItemStats.Count);
        Assert.Contains(report.Students, s => s.Status == null); // HS chưa làm
        Assert.Contains(report.Students, s => s.Score == 6.25m);
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
        public Task<Result> EnsureCanAccessClassAsync(Guid classId, CancellationToken ct = default) => Task.FromResult(Result.Success());
        public Task<bool> CanAccessClassAsync(Guid classId, CancellationToken ct = default) => Task.FromResult(true);
        public Task<Result> EnsureCanAccessStudentAsync(Guid studentId, CancellationToken ct = default) => Task.FromResult(Result.Success());
    }
}
