using HungSilver.Application.Common;
using HungSilver.Application.Settings;
using HungSilver.Application.Warnings;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Warnings;

public sealed class WarningsService(
    AppDbContext context,
    IClassAccessGuard accessGuard,
    ISettingsResolver settings) : IWarningsService
{
    public async Task<Result<WarningsDto>> GetWarningsAsync(Guid? classId, CancellationToken ct = default)
    {
        if (classId is not null)
        {
            var access = await accessGuard.EnsureCanAccessClassAsync(classId.Value, ct);
            if (access.IsFailure)
                return Result.Failure<WarningsDto>(access.Error);
        }

        var classIds = await ScopeClassIdsAsync(classId, ct);
        var studentIds = await context.Enrollments.AsNoTracking()
            .Where(e => classIds.Contains(e.ClassId) && e.IsActive)
            .Select(e => e.StudentId).Distinct().ToListAsync(ct);

        if (studentIds.Count == 0)
            return new WarningsDto([], [], [], []);

        var names = await context.Students.AsNoTracking()
            .Where(s => studentIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.FullName, ct);
        string Name(Guid id) => names.GetValueOrDefault(id, string.Empty);

        // Bản ghi buổi học của các HS trong phạm vi.
        var recs = await (
            from r in context.StudentSessionRecords.AsNoTracking()
            join s in context.ClassSessions.AsNoTracking() on r.ClassSessionId equals s.Id
            where studentIds.Contains(r.StudentId)
            select new { r.StudentId, s.SessionDate, r.Attendance, r.Homework })
            .ToListAsync(ct);

        var absences = new List<WarningItem>();
        var missedHw = new List<WarningItem>();
        foreach (var g in recs.GroupBy(r => r.StudentId))
        {
            var last3 = g.OrderByDescending(r => r.SessionDate).Take(3).ToList();
            if (last3.Count < 3) continue;
            if (last3.All(r => r.Attendance is AttendanceStatus.ExcusedAbsence or AttendanceStatus.UnexcusedAbsence))
                absences.Add(new WarningItem(g.Key, Name(g.Key), "Vắng 3 buổi liên tiếp"));
            if (last3.All(r => r.Homework == HomeworkStatus.NotCompleted))
                missedHw.Add(new WarningItem(g.Key, Name(g.Key), "Không làm bài tập 3 buổi liên tiếp"));
        }

        // Điểm giảm mạnh: so 2 bài Periodic gần nhất.
        var threshold = await GetScoreDropThresholdAsync(ct);
        var assessments = await context.StudentAssessments.AsNoTracking()
            .Where(a => studentIds.Contains(a.StudentId) && a.Type == AssessmentType.Periodic && a.OverallScore != null)
            .Select(a => new { a.StudentId, a.TakenOn, a.OverallScore })
            .ToListAsync(ct);
        var scoreDrop = new List<WarningItem>();
        foreach (var g in assessments.GroupBy(a => a.StudentId))
        {
            var ordered = g.OrderByDescending(a => a.TakenOn).Take(2).ToList();
            if (ordered.Count < 2) continue;
            var drop = ordered[1].OverallScore!.Value - ordered[0].OverallScore!.Value;
            if (drop >= threshold)
                scoreDrop.Add(new WarningItem(g.Key, Name(g.Key), $"Điểm giảm {drop:0.#} (từ {ordered[1].OverallScore} xuống {ordered[0].OverallScore})"));
        }

        // Học phí quá hạn.
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var overdue = await context.TuitionInvoices.AsNoTracking()
            .Where(t => studentIds.Contains(t.StudentId) && t.PaidOn == null && t.DueDate < today)
            .Select(t => new { t.StudentId, t.DueDate, t.Amount })
            .ToListAsync(ct);
        var tuitionOverdue = overdue
            .Select(t => new WarningItem(t.StudentId, Name(t.StudentId), $"Quá hạn từ {t.DueDate:dd/MM/yyyy} ({t.Amount:0} đ)"))
            .ToList();

        return new WarningsDto(absences, missedHw, scoreDrop, tuitionOverdue);
    }

    private async Task<List<Guid>> ScopeClassIdsAsync(Guid? classId, CancellationToken ct)
    {
        if (classId is not null)
            return [classId.Value];
        var q = context.Classes.AsNoTracking().AsQueryable();
        if (!accessGuard.IsAdmin)
            q = q.Where(c => c.TeacherId == accessGuard.TeacherScopeId);
        return await q.Select(c => c.Id).ToListAsync(ct);
    }

    private async Task<decimal> GetScoreDropThresholdAsync(CancellationToken ct)
    {
        var v = await settings.GetEffectiveValueAsync(SettingKeys.WarningScoreDropThreshold, ct: ct);
        return decimal.TryParse(v, out var n) ? n : 1.5m;
    }
}
