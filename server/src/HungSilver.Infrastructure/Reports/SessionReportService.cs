using HungSilver.Application.Common;
using HungSilver.Application.Notifications.Templates;
using HungSilver.Application.Reports;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Reports;

public sealed class SessionReportService(
    AppDbContext context,
    ICurrentRelationCleanupService relationCleanup,
    IClassAccessGuard accessGuard) : ISessionReportService
{
    public async Task<Result<GeneratedReportDto>> GenerateSessionNoticeAsync(Guid sessionId, CancellationToken ct = default)
    {
        var session = await context.ClassSessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sessionId, ct);
        if (session is null)
            return Result.Failure<GeneratedReportDto>(Error.NotFound("Session.NotFound", "Không tìm thấy buổi học."));

        var access = await accessGuard.EnsureCanAccessClassAsync(session.ClassId, ct);
        if (access.IsFailure)
            return Result.Failure<GeneratedReportDto>(access.Error);

        var cls = await context.Classes.AsNoTracking().FirstOrDefaultAsync(c => c.Id == session.ClassId, ct);

        var totalRoster = (await relationCleanup.LoadValidClassSizesAsync([session.ClassId], ct)).GetValueOrDefault(session.ClassId);

        var records = await (
            from r in context.StudentSessionRecords.AsNoTracking()
            join s in context.Students.AsNoTracking() on r.StudentId equals s.Id
            where r.ClassSessionId == sessionId
            select new { r.Attendance, r.Attitude, s.FullName })
            .ToListAsync(ct);

        var present = records.Count(r => r.Attendance is AttendanceStatus.Present or AttendanceStatus.Late);
        var activeStudents = records
            .Where(r => r.Attitude == AttitudeStatus.Positive)
            .Select(r => r.FullName)
            .ToList();

        var journal = await context.TeacherJournals.AsNoTracking().FirstOrDefaultAsync(j => j.ClassSessionId == sessionId, ct);

        var next = await context.ClassSessions.AsNoTracking()
            .Where(s => s.ClassId == session.ClassId && s.Status != SessionStatus.Cancelled
                        && (s.SessionDate > session.SessionDate))
            .OrderBy(s => s.SessionDate).ThenBy(s => s.StartTime)
            .FirstOrDefaultAsync(ct);

        var model = new SessionNoticeModel(
            cls?.Name ?? string.Empty,
            session.SessionNumber,
            session.SessionDate,
            session.Topic,
            journal?.ContentTaught,
            present,
            totalRoster,
            activeStudents,
            journal?.NotesForNextSession,
            next?.SessionDate,
            next?.StartTime);

        var content = ReportTemplates.RenderSessionNotice(model);
        var generatedAt = DateTime.Now;

        var report = await UpsertReportAsync(sessionId, ReportType.SessionNotice, content, generatedAt, ct);
        return new GeneratedReportDto(report.Id, ReportType.SessionNotice, content, generatedAt);
    }

    public async Task<Result<GeneratedReportDto>> GenerateScheduleNoticeAsync(Guid classId, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessClassAsync(classId, ct);
        if (access.IsFailure)
            return Result.Failure<GeneratedReportDto>(access.Error);

        var cls = await context.Classes.AsNoTracking().FirstOrDefaultAsync(c => c.Id == classId, ct);
        if (cls is null)
            return Result.Failure<GeneratedReportDto>(Error.NotFound("Class.NotFound", "Không tìm thấy lớp học."));

        var today = DateOnly.FromDateTime(DateTime.Now);
        var upcoming = await context.ClassSessions.AsNoTracking()
            .Where(s => s.ClassId == classId && s.Status != SessionStatus.Cancelled && s.SessionDate >= today)
            .OrderBy(s => s.SessionDate).ThenBy(s => s.StartTime)
            .FirstOrDefaultAsync(ct);

        var model = new ScheduleNoticeModel(
            cls.Name,
            upcoming?.SessionDate ?? cls.StartDate ?? today,
            upcoming?.StartTime,
            upcoming?.EndTime,
            upcoming?.Topic);

        var content = ReportTemplates.RenderScheduleNotice(model);
        var generatedAt = DateTime.Now;

        Guid? reportId = null;
        if (upcoming is not null)
        {
            var report = await UpsertReportAsync(upcoming.Id, ReportType.ScheduleNotice, content, generatedAt, ct);
            reportId = report.Id;
        }

        return new GeneratedReportDto(reportId, ReportType.ScheduleNotice, content, generatedAt);
    }

    /// <summary>Upsert theo (buổi học, loại báo cáo) — tạo lại ⇒ cập nhật, không nhân bản.</summary>
    private async Task<SessionReport> UpsertReportAsync(
        Guid sessionId, ReportType type, string content, DateTime generatedAt, CancellationToken ct)
    {
        var report = await context.SessionReports
            .FirstOrDefaultAsync(r => r.ClassSessionId == sessionId && r.Type == type, ct);
        if (report is null)
        {
            report = new SessionReport { ClassSessionId = sessionId, Type = type };
            context.SessionReports.Add(report);
        }
        report.GeneratedContent = content;
        report.GeneratedAt = generatedAt;
        await context.SaveChangesAsync(ct);
        return report;
    }
}
