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
    SessionStatus Status,
    // Snapshot từ lớp (Classes) để hiển thị/lọc lịch theo cơ sở · môn · khối · giáo viên (không cần join thêm).
    Guid? TeacherProfileId,
    string? TeacherName,
    Guid? BranchId,
    string? BranchName,
    string? BranchCode,
    string? SubjectName,
    string? GradeName,
    // "Ca" tính sẵn ở server theo cấu hình Schedule.Shifts (theo cơ sở). ShiftOrder = thứ tự Ca (chưa xếp ⇒ int.MaxValue).
    string? ShiftName,
    int ShiftOrder);

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
