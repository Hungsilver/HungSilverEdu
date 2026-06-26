using HungSilver.Application.Schedule;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.Portal;

public sealed record PortalSessionDto(Guid SessionId, string ClassName, DateOnly SessionDate, TimeOnly? StartTime, string? Topic);

public sealed record PortalAssignmentDto(
    Guid Id,
    string ClassName,
    string Title,
    string? Instructions,
    string? MaterialTitle,
    string? MaterialUrl,
    DateOnly? DueDate,
    SubmissionStatus Status,
    DateOnly? SubmittedOn,
    string? Link);

public sealed record SubmitAssignmentRequest(string? Link, string? Note);

public sealed record PortalProfileDto(
    Guid StudentId,
    string FullName,
    string? EnglishLevel,
    string? LearningGoal,
    int TotalSessions,
    int AttendedSessions,
    int HomeworkCompleted,
    int RewardBalance,
    IReadOnlyList<PortalSessionDto> UpcomingSessions);

/// <summary>Cổng thông tin cho học sinh (role User) xem dữ liệu của chính mình.</summary>
public interface IPortalService
{
    Task<Result<PortalProfileDto>> GetMyProfileAsync(CancellationToken ct = default);
    Task<Result<List<PortalAssignmentDto>>> GetMyAssignmentsAsync(CancellationToken ct = default);
    Task<Result> SubmitAssignmentAsync(Guid assignmentId, SubmitAssignmentRequest request, CancellationToken ct = default);

    /// <summary>Lịch học của chính học sinh (các lớp đang ghi danh active) trong khoảng ngày — cùng dạng DTO với lịch Admin/GV.</summary>
    Task<Result<List<CalendarSessionDto>>> GetScheduleRangeAsync(DateOnly from, DateOnly to, CancellationToken ct = default);
}
