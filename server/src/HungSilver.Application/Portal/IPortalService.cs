using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Portal;

public sealed record PortalSessionDto(Guid SessionId, string ClassName, DateOnly SessionDate, TimeOnly? StartTime, string? Topic);

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
}
