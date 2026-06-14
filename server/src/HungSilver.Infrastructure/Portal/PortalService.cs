using HungSilver.Application.Abstractions;
using HungSilver.Application.Portal;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Portal;

public sealed class PortalService(AppDbContext context, ICurrentUser currentUser) : IPortalService
{
    public async Task<Result<PortalProfileDto>> GetMyProfileAsync(CancellationToken ct = default)
    {
        var userId = currentUser.UserId;
        if (userId is null)
            return Result.Failure<PortalProfileDto>(Error.Unauthorized("Portal.Unauthorized", "Chưa đăng nhập."));

        var student = await context.Students.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (student is null)
            return Result.Failure<PortalProfileDto>(Error.NotFound("Portal.NotLinked", "Tài khoản chưa được liên kết với hồ sơ học sinh."));

        var records = await context.StudentSessionRecords.AsNoTracking()
            .Where(r => r.StudentId == student.Id)
            .Select(r => new { r.Attendance, r.Homework })
            .ToListAsync(ct);
        var total = records.Count;
        var attended = records.Count(r => r.Attendance is AttendanceStatus.Present or AttendanceStatus.Late);
        var hwDone = records.Count(r => r.Homework is HomeworkStatus.CompletedWell or HomeworkStatus.Completed);

        var reward = await context.PointEntries.AsNoTracking().Where(p => p.StudentId == student.Id && p.Type == PointType.Reward).SumAsync(p => (int?)p.Points, ct) ?? 0;
        var penalty = await context.PointEntries.AsNoTracking().Where(p => p.StudentId == student.Id && p.Type == PointType.Penalty).SumAsync(p => (int?)p.Points, ct) ?? 0;
        var redeemed = await context.RewardRedemptions.AsNoTracking().Where(r => r.StudentId == student.Id).SumAsync(r => (int?)r.PointsSpent, ct) ?? 0;
        var balance = reward - penalty - redeemed;

        var classIds = await context.Enrollments.AsNoTracking()
            .Where(e => e.StudentId == student.Id && e.IsActive)
            .Select(e => e.ClassId).ToListAsync(ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var upcoming = await (
            from s in context.ClassSessions.AsNoTracking()
            join c in context.Classes.AsNoTracking() on s.ClassId equals c.Id
            where classIds.Contains(s.ClassId) && s.Status != SessionStatus.Cancelled && s.SessionDate >= today
            orderby s.SessionDate, s.StartTime
            select new PortalSessionDto(s.Id, c.Name, s.SessionDate, s.StartTime, s.Topic))
            .Take(10)
            .ToListAsync(ct);

        return new PortalProfileDto(student.Id, student.FullName, student.EnglishLevel, student.LearningGoal,
            total, attended, hwDone, balance, upcoming);
    }
}
