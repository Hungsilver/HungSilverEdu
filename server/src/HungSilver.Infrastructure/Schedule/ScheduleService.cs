using HungSilver.Application.Common;
using HungSilver.Application.Schedule;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Schedule;

public sealed class ScheduleService(
    AppDbContext context,
    IClassAccessGuard accessGuard) : IScheduleService
{
    private static readonly Error SessionNotFound = Error.NotFound("Session.NotFound", "Không tìm thấy buổi học.");

    public async Task<Result<List<CalendarSessionDto>>> GetRangeAsync(DateOnly fromDate, DateOnly toDate, Guid? classId, CancellationToken ct = default)
    {
        if (classId is not null)
        {
            var access = await accessGuard.EnsureCanAccessClassAsync(classId.Value, ct);
            if (access.IsFailure)
                return Result.Failure<List<CalendarSessionDto>>(access.Error);
        }

        var query = from s in context.ClassSessions.AsNoTracking()
                    join c in context.Classes.AsNoTracking() on s.ClassId equals c.Id
                    where s.SessionDate >= fromDate && s.SessionDate <= toDate
                    select new { s, c };

        if (classId is not null)
            query = query.Where(x => x.s.ClassId == classId);

        var scopeId = await accessGuard.GetTeacherScopeIdAsync(ct);
        if (scopeId is not null)
            query = query.Where(x => x.c.TeacherProfileId == scopeId);

        var items = await query
            .OrderBy(x => x.s.SessionDate).ThenBy(x => x.s.StartTime)
            .Select(x => new CalendarSessionDto(
                x.s.Id, x.s.ClassId, x.c.Name, x.s.SessionNumber, x.s.SessionDate,
                x.s.StartTime, x.s.EndTime, x.s.Topic, x.s.Status))
            .ToListAsync(ct);

        return items;
    }

    public async Task<Result<List<ScheduleSlotDto>>> GetSlotsAsync(Guid classId, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessClassAsync(classId, ct);
        if (access.IsFailure)
            return Result.Failure<List<ScheduleSlotDto>>(access.Error);

        var slots = await context.ClassScheduleSlots.AsNoTracking()
            .Where(s => s.ClassId == classId)
            .OrderBy(s => s.DayOfWeek).ThenBy(s => s.StartTime)
            .Select(s => new ScheduleSlotDto(s.Id, s.ClassId, s.DayOfWeek, s.StartTime, s.EndTime))
            .ToListAsync(ct);

        return slots;
    }

    public async Task<Result<ScheduleSlotDto>> AddSlotAsync(CreateSlotRequest request, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessClassAsync(request.ClassId, ct);
        if (access.IsFailure)
            return Result.Failure<ScheduleSlotDto>(access.Error);

        if (request.EndTime <= request.StartTime)
            return Result.Failure<ScheduleSlotDto>(Error.Validation("Schedule.InvalidTime", "Giờ kết thúc phải sau giờ bắt đầu."));

        var slot = new ClassScheduleSlot
        {
            ClassId = request.ClassId,
            DayOfWeek = request.DayOfWeek,
            StartTime = request.StartTime,
            EndTime = request.EndTime
        };
        context.ClassScheduleSlots.Add(slot);
        await context.SaveChangesAsync(ct);

        return new ScheduleSlotDto(slot.Id, slot.ClassId, slot.DayOfWeek, slot.StartTime, slot.EndTime);
    }

    public async Task<Result> RemoveSlotAsync(Guid slotId, CancellationToken ct = default)
    {
        var slot = await context.ClassScheduleSlots.FirstOrDefaultAsync(s => s.Id == slotId, ct);
        if (slot is null)
            return Result.Failure(Error.NotFound("Schedule.SlotNotFound", "Không tìm thấy khung giờ."));

        var access = await accessGuard.EnsureCanAccessClassAsync(slot.ClassId, ct);
        if (access.IsFailure)
            return access;

        context.ClassScheduleSlots.Remove(slot);
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result<int>> GenerateSessionsAsync(Guid classId, GenerateSessionsRequest request, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessClassAsync(classId, ct);
        if (access.IsFailure)
            return Result.Failure<int>(access.Error);

        if (request.ToDate < request.FromDate)
            return Result.Failure<int>(Error.Validation("Schedule.InvalidRange", "Khoảng ngày không hợp lệ."));

        var slots = await context.ClassScheduleSlots.Where(s => s.ClassId == classId).ToListAsync(ct);
        if (slots.Count == 0)
            return Result.Failure<int>(Error.Validation("Schedule.NoSlots", "Lớp chưa có khung giờ học để sinh buổi."));

        var existing = await context.ClassSessions
            .Where(s => s.ClassId == classId && s.SessionDate >= request.FromDate && s.SessionDate <= request.ToDate)
            .Select(s => new { s.SessionDate, s.StartTime })
            .ToListAsync(ct);
        var existingSet = existing.Select(x => (x.SessionDate, x.StartTime)).ToHashSet();

        var maxNum = await context.ClassSessions
            .Where(s => s.ClassId == classId)
            .Select(s => (int?)s.SessionNumber)
            .MaxAsync(ct) ?? 0;

        var toCreate = new List<ClassSession>();
        for (var d = request.FromDate; d <= request.ToDate; d = d.AddDays(1))
        {
            foreach (var slot in slots.Where(sl => sl.DayOfWeek == d.DayOfWeek))
            {
                if (existingSet.Contains((d, slot.StartTime)))
                    continue;

                toCreate.Add(new ClassSession
                {
                    ClassId = classId,
                    SessionDate = d,
                    StartTime = slot.StartTime,
                    EndTime = slot.EndTime,
                    Status = SessionStatus.Scheduled
                });
            }
        }

        var n = maxNum;
        foreach (var s in toCreate.OrderBy(s => s.SessionDate).ThenBy(s => s.StartTime))
            s.SessionNumber = ++n;

        context.ClassSessions.AddRange(toCreate);
        await context.SaveChangesAsync(ct);
        return toCreate.Count;
    }

    public async Task<Result<CalendarSessionDto>> CreateSessionAsync(CreateSessionRequest request, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessClassAsync(request.ClassId, ct);
        if (access.IsFailure)
            return Result.Failure<CalendarSessionDto>(access.Error);

        var cls = await context.Classes.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.ClassId, ct);
        if (cls is null)
            return Result.Failure<CalendarSessionDto>(Error.NotFound("Class.NotFound", "Không tìm thấy lớp học."));

        var number = request.SessionNumber;
        if (number is null or <= 0)
        {
            var maxNum = await context.ClassSessions
                .Where(s => s.ClassId == request.ClassId)
                .Select(s => (int?)s.SessionNumber)
                .MaxAsync(ct) ?? 0;
            number = maxNum + 1;
        }

        var session = new ClassSession
        {
            ClassId = request.ClassId,
            SessionNumber = number.Value,
            SessionDate = request.SessionDate,
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            Topic = request.Topic?.Trim(),
            Status = SessionStatus.Scheduled
        };
        context.ClassSessions.Add(session);
        await context.SaveChangesAsync(ct);

        return new CalendarSessionDto(session.Id, session.ClassId, cls.Name, session.SessionNumber,
            session.SessionDate, session.StartTime, session.EndTime, session.Topic, session.Status);
    }

    public async Task<Result> CancelSessionAsync(Guid sessionId, CancellationToken ct = default)
    {
        var session = await context.ClassSessions.FirstOrDefaultAsync(s => s.Id == sessionId, ct);
        if (session is null)
            return Result.Failure(SessionNotFound);

        var access = await accessGuard.EnsureCanAccessClassAsync(session.ClassId, ct);
        if (access.IsFailure)
            return access;

        session.Status = SessionStatus.Cancelled;
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }
}
