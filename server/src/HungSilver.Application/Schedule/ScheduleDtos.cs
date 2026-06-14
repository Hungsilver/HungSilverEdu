using HungSilver.Domain.Enums;

namespace HungSilver.Application.Schedule;

public sealed record CalendarSessionDto(
    Guid Id,
    Guid ClassId,
    string ClassName,
    int SessionNumber,
    DateOnly SessionDate,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    string? Topic,
    SessionStatus Status);

public sealed record ScheduleSlotDto(
    Guid Id,
    Guid ClassId,
    DayOfWeek DayOfWeek,
    TimeOnly StartTime,
    TimeOnly EndTime);

public sealed record CreateSlotRequest(
    Guid ClassId,
    DayOfWeek DayOfWeek,
    TimeOnly StartTime,
    TimeOnly EndTime);

public sealed record GenerateSessionsRequest(DateOnly FromDate, DateOnly ToDate);

public sealed record CreateSessionRequest(
    Guid ClassId,
    DateOnly SessionDate,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    string? Topic,
    int? SessionNumber);
