using HungSilver.Application.Common;
using HungSilver.Application.Notifications.Templates;
using HungSilver.Application.Reports;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Reports;

public sealed class ParentReportService(
    AppDbContext context,
    IClassAccessGuard accessGuard) : IParentReportService
{
    public async Task<Result<ParentReportDto>> GenerateAsync(Guid studentId, int year, int month, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessStudentAsync(studentId, ct);
        if (access.IsFailure)
            return Result.Failure<ParentReportDto>(access.Error);

        var student = await context.Students.AsNoTracking().FirstOrDefaultAsync(s => s.Id == studentId, ct);
        if (student is null)
            return Result.Failure<ParentReportDto>(Error.NotFound("Student.NotFound", "Không tìm thấy học sinh."));

        var fromDate = new DateOnly(year, month, 1);
        var toDate = fromDate.AddMonths(1).AddDays(-1);

        var records = await (
            from r in context.StudentSessionRecords.AsNoTracking()
            join s in context.ClassSessions.AsNoTracking() on r.ClassSessionId equals s.Id
            where r.StudentId == studentId && s.SessionDate >= fromDate && s.SessionDate <= toDate
            select new { r.Attendance, r.Homework })
            .ToListAsync(ct);

        var total = records.Count;
        var attended = records.Count(r => r.Attendance is AttendanceStatus.Present or AttendanceStatus.Late);
        var hwDone = records.Count(r => r.Homework is HomeworkStatus.CompletedWell or HomeworkStatus.Completed);
        var hwPercent = total == 0 ? 0 : Math.Round((decimal)hwDone / total * 100, 0);

        var points = await context.PointEntries.AsNoTracking()
            .Where(p => p.StudentId == studentId
                        && DateOnly.FromDateTime(p.CreatedAtUtc) >= fromDate
                        && DateOnly.FromDateTime(p.CreatedAtUtc) <= toDate)
            .ToListAsync(ct);
        var rewardPoints = points.Where(p => p.Type == PointType.Reward).Sum(p => p.Points)
                           - points.Where(p => p.Type == PointType.Penalty).Sum(p => p.Points);

        var eval = await context.MonthlyEvaluations.AsNoTracking()
            .FirstOrDefaultAsync(m => m.StudentId == studentId && m.Year == year && m.Month == month, ct);

        var model = new ParentReportModel(
            student.FullName, year, month, attended, total, hwPercent, rewardPoints,
            eval?.Comment, eval is null ? null : "Tiếp tục duy trì và phát huy ở nhà.");

        var content = ReportTemplates.RenderParentReport(model);
        var generatedAt = DateTime.UtcNow;

        var report = new MonthlyParentReport
        {
            StudentId = studentId,
            Year = year,
            Month = month,
            SessionsAttended = attended,
            SessionsTotal = total,
            HomeworkCompletionPercent = hwPercent,
            RewardPoints = rewardPoints,
            AssessmentText = eval?.Comment,
            Suggestion = model.Suggestion,
            GeneratedContent = content
        };
        context.MonthlyParentReports.Add(report);
        await context.SaveChangesAsync(ct);

        return new ParentReportDto(report.Id, year, month, content, generatedAt);
    }
}
