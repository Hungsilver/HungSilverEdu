using HungSilver.Application.Common;
using HungSilver.Application.Dashboard;
using HungSilver.Application.Settings;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Dashboard;

public sealed class DashboardService(
    AppDbContext context,
    IClassAccessGuard accessGuard,
    ISettingsResolver settings) : IDashboardService
{
    public async Task<Result<DashboardSummaryDto>> GetSummaryAsync(CancellationToken ct = default)
    {
        var classIds = await GetScopeClassIdsAsync(ct);
        var today = await GetTodayAsync(ct);

        var studentIds = await context.Enrollments.AsNoTracking()
            .Where(e => classIds.Contains(e.ClassId) && e.IsActive)
            .Select(e => e.StudentId)
            .Distinct()
            .ToListAsync(ct);

        var todaySchedule = await (
            from s in context.ClassSessions.AsNoTracking()
            join c in context.Classes.AsNoTracking() on s.ClassId equals c.Id
            where classIds.Contains(s.ClassId) && s.SessionDate == today && s.Status != SessionStatus.Cancelled
            orderby s.StartTime
            select new TodaySessionDto(s.Id, s.ClassId, c.Name, s.StartTime, s.EndTime, s.Topic))
            .ToListAsync(ct);

        var dueSoonDays = await GetIntSettingAsync(SettingKeys.TuitionDueSoonDays, 7, ct);
        var dueLimit = today.AddDays(dueSoonDays);
        var dueRaw = await (
            from t in context.TuitionInvoices.AsNoTracking()
            join s in context.Students.AsNoTracking() on t.StudentId equals s.Id
            where studentIds.Contains(t.StudentId) && t.PaidOn == null && t.DueDate <= dueLimit
            orderby t.DueDate
            select new { s.Id, s.FullName, t.Amount, t.DueDate })
            .Take(10)
            .ToListAsync(ct);
        // Tính lại trạng thái hiệu lực (đều chưa đóng & trong hạn cảnh báo → Overdue/DueSoon).
        var tuitionDue = dueRaw
            .Select(t => new TuitionDueDto(t.Id, t.FullName, t.Amount, t.DueDate,
                t.DueDate < today ? TuitionStatus.Overdue : TuitionStatus.DueSoon))
            .ToList();

        // Bản ghi buổi học (có ngày + tên) trong phạm vi — dùng cho vắng/thiếu BTVN/cảnh báo.
        var recs = await (
            from r in context.StudentSessionRecords.AsNoTracking()
            join se in context.ClassSessions.AsNoTracking() on r.ClassSessionId equals se.Id
            join c in context.Classes.AsNoTracking() on se.ClassId equals c.Id
            join st in context.Students.AsNoTracking() on r.StudentId equals st.Id
            where classIds.Contains(se.ClassId)
            select new RecRow(r.StudentId, st.FullName, c.Name, se.SessionDate, r.Attendance, r.Homework))
            .ToListAsync(ct);

        var weekAgo = today.AddDays(-7);

        var recentAbsentees = recs
            .Where(r => r.SessionDate >= weekAgo &&
                        r.Attendance is AttendanceStatus.ExcusedAbsence or AttendanceStatus.UnexcusedAbsence)
            .OrderByDescending(r => r.SessionDate)
            .Take(10)
            .Select(r => new AbsenteeDto(r.StudentId, r.FullName, r.ClassName, r.SessionDate))
            .ToList();

        var missingHomework = recs
            .Where(r => r.SessionDate >= weekAgo && r.Homework == HomeworkStatus.NotCompleted)
            .OrderByDescending(r => r.SessionDate)
            .Take(10)
            .Select(r => new MissingHomeworkDto(r.StudentId, r.FullName, r.ClassName, r.SessionDate))
            .ToList();

        // Cần theo dõi: 3 buổi gần nhất đều vắng / đều không làm BTVN.
        var needAttention = new List<AttentionStudentDto>();
        foreach (var grp in recs.GroupBy(r => r.StudentId))
        {
            var last3 = grp.OrderByDescending(r => r.SessionDate).Take(3).ToList();
            if (last3.Count < 3) continue;

            if (last3.All(r => r.Attendance is AttendanceStatus.ExcusedAbsence or AttendanceStatus.UnexcusedAbsence))
                needAttention.Add(new AttentionStudentDto(grp.Key, last3[0].FullName, "Vắng 3 buổi gần nhất"));
            else if (last3.All(r => r.Homework == HomeworkStatus.NotCompleted))
                needAttention.Add(new AttentionStudentDto(grp.Key, last3[0].FullName, "Không làm BTVN 3 buổi gần nhất"));
        }
        needAttention = needAttention.Take(10).ToList();

        var balances = await ComputeBalancesAsync(studentIds, ct);
        var nameMap = await context.Students.AsNoTracking()
            .Where(s => studentIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.FullName, ct);
        var topStudents = balances
            .OrderByDescending(kv => kv.Value)
            .Take(10)
            .Select(kv => new TopStudentDto(kv.Key, nameMap.GetValueOrDefault(kv.Key, string.Empty), kv.Value))
            .ToList();

        var summary = new DashboardSummaryDto(
            studentIds.Count,
            classIds.Count,
            todaySchedule.Count,
            todaySchedule,
            tuitionDue,
            recentAbsentees,
            missingHomework,
            topStudents,
            needAttention);

        return summary;
    }

    public async Task<Result<DashboardChartsDto>> GetChartsAsync(CancellationToken ct = default)
    {
        var classIds = await GetScopeClassIdsAsync(ct);

        var studentIds = await context.Enrollments.AsNoTracking()
            .Where(e => classIds.Contains(e.ClassId) && e.IsActive)
            .Select(e => e.StudentId)
            .Distinct()
            .ToListAsync(ct);

        var recs = await (
            from r in context.StudentSessionRecords.AsNoTracking()
            join s in context.ClassSessions.AsNoTracking() on r.ClassSessionId equals s.Id
            where classIds.Contains(s.ClassId)
            select new { s.SessionDate, r.Attendance, r.Homework })
            .ToListAsync(ct);

        var attendanceByMonth = recs
            .GroupBy(r => new { r.SessionDate.Year, r.SessionDate.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .TakeLast(6)
            .Select(g => new MonthRateDto(
                MonthLabel(g.Key.Year, g.Key.Month),
                Rate(g.Count(x => x.Attendance is AttendanceStatus.Present or AttendanceStatus.Late), g.Count())))
            .ToList();

        var homeworkByMonth = recs
            .GroupBy(r => new { r.SessionDate.Year, r.SessionDate.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .TakeLast(6)
            .Select(g => new MonthRateDto(
                MonthLabel(g.Key.Year, g.Key.Month),
                Rate(g.Count(x => x.Homework is HomeworkStatus.CompletedWell or HomeworkStatus.Completed), g.Count())))
            .ToList();

        var pts = await context.PointEntries.AsNoTracking()
            .Where(p => p.ClassSessionId != null)
            .Join(context.ClassSessions.AsNoTracking(), p => p.ClassSessionId!.Value, s => s.Id, (p, s) => new { p.Type, p.Points, s.ClassId })
            .Join(context.Classes.AsNoTracking(), x => x.ClassId, c => c.Id, (x, c) => new { x.Type, x.Points, c.Name, c.Id })
            .Where(x => classIds.Contains(x.Id))
            .ToListAsync(ct);

        var rewardPointsByClass = pts
            .GroupBy(x => x.Name)
            .Select(g => new ClassPointsDto(
                g.Key,
                g.Where(x => x.Type == PointType.Reward).Sum(x => x.Points) - g.Where(x => x.Type == PointType.Penalty).Sum(x => x.Points)))
            .OrderByDescending(x => x.Points)
            .ToList();

        var assess = await context.StudentAssessments.AsNoTracking()
            .Where(a => studentIds.Contains(a.StudentId) && a.Type == AssessmentType.Periodic && a.OverallScore != null)
            .Select(a => new { a.TakenOn, a.OverallScore })
            .ToListAsync(ct);

        var testScoreGrowth = assess
            .GroupBy(a => new { a.TakenOn.Year, a.TakenOn.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .TakeLast(6)
            .Select(g => new MonthScoreDto(MonthLabel(g.Key.Year, g.Key.Month), Math.Round(g.Average(x => x.OverallScore!.Value), 2)))
            .ToList();

        return new DashboardChartsDto(attendanceByMonth, homeworkByMonth, rewardPointsByClass, testScoreGrowth);
    }

    private sealed record RecRow(Guid StudentId, string FullName, string ClassName, DateOnly SessionDate, AttendanceStatus Attendance, HomeworkStatus Homework);

    private async Task<List<Guid>> GetScopeClassIdsAsync(CancellationToken ct)
    {
        var q = context.Classes.AsNoTracking().AsQueryable();
        if (!accessGuard.IsAdmin)
            q = q.Where(c => c.TeacherId == accessGuard.TeacherScopeId);
        return await q.Select(c => c.Id).ToListAsync(ct);
    }

    private async Task<Dictionary<Guid, int>> ComputeBalancesAsync(List<Guid> studentIds, CancellationToken ct)
    {
        if (studentIds.Count == 0)
            return [];

        var pointAgg = await context.PointEntries.AsNoTracking()
            .Where(p => studentIds.Contains(p.StudentId))
            .GroupBy(p => p.StudentId)
            .Select(g => new
            {
                StudentId = g.Key,
                Reward = g.Where(x => x.Type == PointType.Reward).Sum(x => x.Points),
                Penalty = g.Where(x => x.Type == PointType.Penalty).Sum(x => x.Points)
            })
            .ToListAsync(ct);

        var redeemed = await context.RewardRedemptions.AsNoTracking()
            .Where(r => studentIds.Contains(r.StudentId))
            .GroupBy(r => r.StudentId)
            .Select(g => new { StudentId = g.Key, Spent = g.Sum(x => x.PointsSpent) })
            .ToDictionaryAsync(x => x.StudentId, x => x.Spent, ct);

        var result = new Dictionary<Guid, int>();
        foreach (var id in studentIds)
        {
            var agg = pointAgg.FirstOrDefault(x => x.StudentId == id);
            result[id] = (agg?.Reward ?? 0) - (agg?.Penalty ?? 0) - redeemed.GetValueOrDefault(id);
        }
        return result;
    }

    private Task<DateOnly> GetTodayAsync(CancellationToken ct) =>
        Task.FromResult(DateOnly.FromDateTime(DateTime.Now));

    private async Task<int> GetIntSettingAsync(string key, int fallback, CancellationToken ct)
    {
        var value = await settings.GetEffectiveValueAsync(key, ct: ct);
        return int.TryParse(value, out var n) ? n : fallback;
    }

    private static string MonthLabel(int year, int month) => $"{month:D2}/{year}";

    private static decimal Rate(int part, int total) => total == 0 ? 0 : Math.Round((decimal)part / total * 100, 1);
}
