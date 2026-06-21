using HungSilver.Application.Common;
using HungSilver.Application.Settings;
using HungSilver.Application.Warnings;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using HungSilver.Infrastructure.Persistence.Interceptors;
using HungSilver.Infrastructure.Common;
using HungSilver.Infrastructure.Reports;
using HungSilver.Infrastructure.Warnings;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>
/// Kiểm thử các sửa lỗi đợt rà soát: sinh báo cáo idempotent (A3) và cảnh báo "3 buổi liên tiếp"
/// xét theo TỪNG lớp, loại buổi đã hủy, mỗi học sinh chỉ cảnh báo một lần (A4).
/// </summary>
public sealed class ReportAndWarningsTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;

    public ReportAndWarningsTests()
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

    // ---------- A3: sinh báo cáo không nhân bản ----------

    [Fact]
    public async Task RegenerateSessionNotice_UpsertsSingleRow()
    {
        var classId = await AddClassAsync("Lớp A");
        var session = await AddSessionAsync(classId, number: 1, daysAgo: 0);

        var service = new SessionReportService(_context, new CurrentRelationCleanupService(_context), new AdminGuard());

        var first = await service.GenerateSessionNoticeAsync(session);
        var second = await service.GenerateSessionNoticeAsync(session);

        Assert.True(first.IsSuccess);
        Assert.True(second.IsSuccess);
        // Tạo lại không nhân bản: vẫn đúng 1 bản ghi cho (buổi, loại) và cùng một Id.
        var count = await _context.SessionReports.CountAsync(r => r.ClassSessionId == session && r.Type == ReportType.SessionNotice);
        Assert.Equal(1, count);
        Assert.Equal(first.Value.Id, second.Value.Id);
    }

    // ---------- A4: cảnh báo vắng 3 buổi liên tiếp ----------

    [Fact]
    public async Task ConsecutiveAbsence_SameClass_WarnsOnce()
    {
        var classA = await AddClassAsync("Lớp A");
        var classB = await AddClassAsync("Lớp B");
        var student = await AddStudentAsync("Nguyễn Văn A");
        await EnrollAsync(student, classA);
        await EnrollAsync(student, classB);

        // Lớp A: 3 buổi gần nhất đều vắng → phải cảnh báo. Lớp B: có mặt.
        await AddRecordAsync(classA, student, daysAgo: 3, AttendanceStatus.UnexcusedAbsence);
        await AddRecordAsync(classA, student, daysAgo: 2, AttendanceStatus.UnexcusedAbsence);
        await AddRecordAsync(classA, student, daysAgo: 1, AttendanceStatus.ExcusedAbsence);
        await AddRecordAsync(classB, student, daysAgo: 1, AttendanceStatus.Present);

        var result = await GetWarningsAsync();

        Assert.True(result.IsSuccess);
        // Đúng một mục cảnh báo cho học sinh này (không nhân đôi dù học nhiều lớp).
        Assert.Single(result.Value.ConsecutiveAbsences, w => w.StudentId == student);
    }

    [Fact]
    public async Task AbsencesSplitAcrossClasses_DoNotWarn()
    {
        var classA = await AddClassAsync("Lớp A");
        var classB = await AddClassAsync("Lớp B");
        var student = await AddStudentAsync("Trần Thị B");
        await EnrollAsync(student, classA);
        await EnrollAsync(student, classB);

        // 4 buổi vắng nhưng chia đều 2 lớp (mỗi lớp 2) → KHÔNG lớp nào đủ 3 liên tiếp.
        await AddRecordAsync(classA, student, daysAgo: 4, AttendanceStatus.UnexcusedAbsence);
        await AddRecordAsync(classA, student, daysAgo: 3, AttendanceStatus.UnexcusedAbsence);
        await AddRecordAsync(classB, student, daysAgo: 2, AttendanceStatus.UnexcusedAbsence);
        await AddRecordAsync(classB, student, daysAgo: 1, AttendanceStatus.UnexcusedAbsence);

        var result = await GetWarningsAsync();

        Assert.True(result.IsSuccess);
        Assert.DoesNotContain(result.Value.ConsecutiveAbsences, w => w.StudentId == student);
    }

    [Fact]
    public async Task CancelledSession_ExcludedFromStreak()
    {
        var classA = await AddClassAsync("Lớp A");
        var student = await AddStudentAsync("Lê Văn C");
        await EnrollAsync(student, classA);

        // 3 buổi đều vắng nhưng buổi mới nhất đã HỦY → chỉ còn 2 buổi hợp lệ → không cảnh báo.
        await AddRecordAsync(classA, student, daysAgo: 3, AttendanceStatus.UnexcusedAbsence);
        await AddRecordAsync(classA, student, daysAgo: 2, AttendanceStatus.UnexcusedAbsence);
        await AddRecordAsync(classA, student, daysAgo: 1, AttendanceStatus.UnexcusedAbsence, status: SessionStatus.Cancelled);

        var result = await GetWarningsAsync();

        Assert.True(result.IsSuccess);
        Assert.DoesNotContain(result.Value.ConsecutiveAbsences, w => w.StudentId == student);
    }

    // ---------- Helpers ----------

    private Task<Result<WarningsDto>> GetWarningsAsync() =>
        new WarningsService(_context, new AdminGuard(), new CurrentRelationCleanupService(_context), new DefaultSettings()).GetWarningsAsync(classId: null);

    private async Task<Guid> AddClassAsync(string name)
    {
        var cls = new ClassRoom { Name = name, TeacherId = Guid.NewGuid(), MaxCapacity = 30 };
        _context.Classes.Add(cls);
        await _context.SaveChangesAsync();
        return cls.Id;
    }

    private async Task<Guid> AddStudentAsync(string fullName)
    {
        var student = new Student { StudentCode = HungSilver.Domain.Common.UniqueCodeGenerator.Next("HS"), FullName = fullName };
        _context.Students.Add(student);
        await _context.SaveChangesAsync();
        return student.Id;
    }

    private async Task EnrollAsync(Guid studentId, Guid classId)
    {
        _context.Enrollments.Add(new Enrollment
        {
            StudentId = studentId,
            ClassId = classId,
            EnrolledOn = DateOnly.FromDateTime(DateTime.Now.AddMonths(-1)),
            IsActive = true
        });
        await _context.SaveChangesAsync();
    }

    private async Task<Guid> AddSessionAsync(Guid classId, int number, int daysAgo, SessionStatus status = SessionStatus.Scheduled)
    {
        var session = new ClassSession
        {
            ClassId = classId,
            SessionNumber = number,
            SessionDate = DateOnly.FromDateTime(DateTime.Now.AddDays(-daysAgo)),
            StartTime = new TimeOnly(18, 0),
            Status = status
        };
        _context.ClassSessions.Add(session);
        await _context.SaveChangesAsync();
        return session.Id;
    }

    private async Task AddRecordAsync(Guid classId, Guid studentId, int daysAgo, AttendanceStatus attendance, SessionStatus status = SessionStatus.Scheduled)
    {
        var sessionId = await AddSessionAsync(classId, number: daysAgo, daysAgo: daysAgo, status: status);
        _context.StudentSessionRecords.Add(new StudentSessionRecord
        {
            ClassSessionId = sessionId,
            StudentId = studentId,
            Attendance = attendance
        });
        await _context.SaveChangesAsync();
    }

    private sealed class AdminGuard : IClassAccessGuard
    {
        public bool IsAdmin => true;
        public Task<Guid?> GetTeacherScopeIdAsync(CancellationToken ct = default) => Task.FromResult<Guid?>(null);
        public Task<Result> EnsureCanAccessClassAsync(Guid classId, CancellationToken ct = default) => Task.FromResult(Result.Success());
        public Task<bool> CanAccessClassAsync(Guid classId, CancellationToken ct = default) => Task.FromResult(true);
        public Task<Result> EnsureCanAccessStudentAsync(Guid studentId, CancellationToken ct = default) => Task.FromResult(Result.Success());
    }

    private sealed class DefaultSettings : ISettingsResolver
    {
        public Task<string?> GetEffectiveValueAsync(string key, Guid? classId = null, Guid? userId = null, CancellationToken ct = default) =>
            Task.FromResult<string?>(null);

        public Task<IReadOnlyDictionary<string, string>> GetEffectiveAllAsync(Guid? classId = null, Guid? userId = null, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyDictionary<string, string>>(new Dictionary<string, string>());
    }
}
