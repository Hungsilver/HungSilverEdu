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
/// Service nền chốt bài BỎ DỞ (fix: auto-submit chỉ chạy ở client): attempt InProgress quá hạn
/// giờ làm ⇒ tự chấm phần đã lưu (AutoSubmitted); trong hạn / đã nộp / mồ côi ⇒ giữ nguyên.
/// </summary>
public sealed class ExamAttemptFinalizeTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;

    public ExamAttemptFinalizeTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection).AddInterceptors(new AuditSaveChangesInterceptor()).Options;
        _context = new AppDbContext(options);
        _context.Database.EnsureCreated();
    }

    public void Dispose() { _context.Dispose(); _connection.Dispose(); }

    // ---- Seed helpers ----

    private (Exam exam, ExamQuestion q1, ExamQuestion q2) SeedExam()
    {
        var exam = new Exam { Title = "Đề", Status = ExamStatus.Published, TotalPoints = 10m };
        _context.Exams.Add(exam);
        _context.SaveChanges();
        var q1 = new ExamQuestion { ExamId = exam.Id, OrderNo = 0, Type = ExamQuestionType.TrueFalse, Stem = "C1", AnswerJson = "{\"value\":true}", Points = 5m };
        var q2 = new ExamQuestion { ExamId = exam.Id, OrderNo = 1, Type = ExamQuestionType.TrueFalse, Stem = "C2", AnswerJson = "{\"value\":false}", Points = 5m };
        _context.ExamQuestions.AddRange(q1, q2);
        _context.SaveChanges();
        return (exam, q1, q2);
    }

    private ExamAssignment SeedAssignment(Guid examId, int duration = 30)
    {
        var a = new ExamAssignment
        {
            ExamId = examId, ExamTitle = "Đề", ClassId = Guid.NewGuid(), DurationMinutes = duration,
            OpenAt = DateTime.Now.AddHours(-3), TotalPoints = 10m, Status = ExamAssignmentStatus.Open
        };
        _context.ExamAssignments.Add(a);
        _context.SaveChanges();
        return a;
    }

    private ExamAttempt SeedAttempt(Guid assignmentId, DateTime startedAt, ExamAttemptStatus status = ExamAttemptStatus.InProgress)
    {
        var t = new ExamAttempt { ExamAssignmentId = assignmentId, StudentId = Guid.NewGuid(), Status = status, StartedAt = startedAt };
        _context.ExamAttempts.Add(t);
        _context.SaveChanges();
        return t;
    }

    // ---- Tests ----

    [Fact]
    public async Task ExpiredInProgress_IsGradedFromSavedAnswers_AutoSubmitted()
    {
        var (exam, q1, _) = SeedExam();
        var assignment = SeedAssignment(exam.Id, duration: 30);
        var attempt = SeedAttempt(assignment.Id, DateTime.Now.AddMinutes(-90)); // quá hạn từ lâu
        // HS kịp lưu 1 câu đúng trước khi rớt mạng; câu 2 không trả lời.
        _context.ExamAttemptAnswers.Add(new ExamAttemptAnswer { AttemptId = attempt.Id, QuestionId = q1.Id, ResponseJson = "{\"value\":true}" });
        await _context.SaveChangesAsync();

        var finalized = await ExamAttemptFinalizeService.FinalizeExpiredCoreAsync(_context, DateTime.Now);

        Assert.Equal(1, finalized);
        var saved = await _context.ExamAttempts.FirstAsync(t => t.Id == attempt.Id);
        Assert.Equal(ExamAttemptStatus.AutoSubmitted, saved.Status);
        Assert.Equal(5m, saved.Score);          // câu 1 đúng 5đ, câu 2 không trả lời 0đ
        Assert.Equal(1, saved.CorrectCount);
        Assert.Equal(2, saved.TotalCount);
        Assert.NotNull(saved.SubmittedAt);
        // Câu không trả lời được ghi bản ghi rỗng (IsCorrect=false) để review/báo cáo đầy đủ.
        Assert.Equal(2, await _context.ExamAttemptAnswers.CountAsync(x => x.AttemptId == attempt.Id));
    }

    [Fact]
    public async Task WithinTime_IsLeftInProgress()
    {
        var (exam, _, _) = SeedExam();
        var assignment = SeedAssignment(exam.Id, duration: 60);
        var attempt = SeedAttempt(assignment.Id, DateTime.Now.AddMinutes(-10));

        var finalized = await ExamAttemptFinalizeService.FinalizeExpiredCoreAsync(_context, DateTime.Now);

        Assert.Equal(0, finalized);
        Assert.Equal(ExamAttemptStatus.InProgress, (await _context.ExamAttempts.FirstAsync(t => t.Id == attempt.Id)).Status);
    }

    [Fact]
    public async Task AlreadySubmitted_IsSkipped()
    {
        var (exam, _, _) = SeedExam();
        var assignment = SeedAssignment(exam.Id, duration: 30);
        var attempt = SeedAttempt(assignment.Id, DateTime.Now.AddMinutes(-90), ExamAttemptStatus.Submitted);
        attempt.Score = 7m;
        await _context.SaveChangesAsync();

        var finalized = await ExamAttemptFinalizeService.FinalizeExpiredCoreAsync(_context, DateTime.Now);

        Assert.Equal(0, finalized);
        var saved = await _context.ExamAttempts.FirstAsync(t => t.Id == attempt.Id);
        Assert.Equal(ExamAttemptStatus.Submitted, saved.Status);
        Assert.Equal(7m, saved.Score); // không chấm lại
    }

    [Fact]
    public async Task OrphanAttempt_AssignmentSoftDeleted_IsSkippedWithoutThrow()
    {
        var (exam, _, _) = SeedExam();
        var assignment = SeedAssignment(exam.Id, duration: 30);
        var attempt = SeedAttempt(assignment.Id, DateTime.Now.AddMinutes(-90));
        _context.ExamAssignments.Remove(assignment); // xóa mềm ⇒ attempt mồ côi
        await _context.SaveChangesAsync();

        var finalized = await ExamAttemptFinalizeService.FinalizeExpiredCoreAsync(_context, DateTime.Now);

        Assert.Equal(0, finalized);
        Assert.Equal(ExamAttemptStatus.InProgress, (await _context.ExamAttempts.FirstAsync(t => t.Id == attempt.Id)).Status);
    }
}
