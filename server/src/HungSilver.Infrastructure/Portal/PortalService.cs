using HungSilver.Application.Abstractions;
using HungSilver.Application.Portal;
using HungSilver.Application.Schedule;
using HungSilver.Application.Settings;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Portal;

public sealed class PortalService(
    AppDbContext context,
    ICurrentUser currentUser,
    ISettingsResolver settings) : IPortalService
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

        var classIds = await LoadStudentClassIdsAsync(student.Id, ct);

        var today = DateOnly.FromDateTime(DateTime.Now);
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

    public async Task<Result<List<CalendarSessionDto>>> GetScheduleRangeAsync(DateOnly fromDate, DateOnly toDate, CancellationToken ct = default)
    {
        var studentResult = await GetLinkedStudentAsync(ct);
        if (studentResult.IsFailure)
            return Result.Failure<List<CalendarSessionDto>>(studentResult.Error);
        var student = studentResult.Value;

        var classIds = await LoadStudentClassIdsAsync(student.Id, ct);
        if (classIds.Count == 0)
            return new List<CalendarSessionDto>();

        var rows = await (
            from s in context.ClassSessions.AsNoTracking()
            join c in context.Classes.AsNoTracking() on s.ClassId equals c.Id
            where classIds.Contains(s.ClassId) && s.SessionDate >= fromDate && s.SessionDate <= toDate
            orderby s.SessionDate, s.StartTime
            select new
            {
                s.Id, s.ClassId, c.Name, s.SessionNumber, s.SessionDate, s.StartTime, s.EndTime, s.Topic, s.Status,
                c.TeacherProfileId, c.TeacherName, c.BranchId, c.BranchName, c.BranchCode, c.SubjectName, c.GradeName
            }).ToListAsync(ct);

        var shiftJson = await settings.GetEffectiveValueAsync(SettingKeys.ScheduleShifts, ct: ct);
        var shifts = ShiftResolver.Parse(shiftJson);

        return rows
            .Select(r =>
            {
                var (shiftName, shiftOrder) = shifts.Resolve(r.BranchId, r.StartTime);
                return new CalendarSessionDto(
                    r.Id, r.ClassId, r.Name, r.SessionNumber, r.SessionDate,
                    r.StartTime, r.EndTime, r.Topic, r.Status,
                    r.TeacherProfileId, r.TeacherName, r.BranchId, r.BranchName, r.BranchCode,
                    r.SubjectName, r.GradeName, shiftName, shiftOrder);
            })
            .OrderBy(i => i.SessionDate).ThenBy(i => i.ShiftOrder).ThenBy(i => i.StartTime)
            .ToList();
    }

    private async Task<Result<Student>> GetLinkedStudentAsync(CancellationToken ct)
    {
        var userId = currentUser.UserId;
        if (userId is null)
            return Result.Failure<Student>(Error.Unauthorized("Portal.Unauthorized", "Chưa đăng nhập."));

        var student = await context.Students.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (student is null)
            return Result.Failure<Student>(Error.NotFound("Portal.NotLinked", "Tài khoản chưa được liên kết với hồ sơ học sinh."));

        return student;
    }

    private async Task<List<Guid>> LoadStudentClassIdsAsync(Guid studentId, CancellationToken ct)
    {
        var rows = await (
            from e in context.Enrollments.AsNoTracking()
            join s in context.Students.AsNoTracking() on e.StudentId equals s.Id
            join c in context.Classes.AsNoTracking() on e.ClassId equals c.Id
            where e.StudentId == studentId && e.IsActive
            select e.ClassId)
            .Distinct()
            .ToListAsync(ct);

        return rows;
    }
}
