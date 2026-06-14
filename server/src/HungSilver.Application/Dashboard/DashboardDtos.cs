using HungSilver.Domain.Enums;

namespace HungSilver.Application.Dashboard;

public sealed record DashboardSummaryDto(
    int TotalActiveStudents,
    int TotalClasses,
    int SessionsToday,
    IReadOnlyList<TodaySessionDto> TodaySchedule,
    IReadOnlyList<TuitionDueDto> TuitionDueSoon,
    IReadOnlyList<AbsenteeDto> RecentAbsentees,
    IReadOnlyList<MissingHomeworkDto> MissingHomework,
    IReadOnlyList<TopStudentDto> TopStudents,
    IReadOnlyList<AttentionStudentDto> NeedAttention);

public sealed record TodaySessionDto(Guid SessionId, Guid ClassId, string ClassName, TimeOnly? StartTime, TimeOnly? EndTime, string? Topic);
public sealed record TuitionDueDto(Guid StudentId, string StudentName, decimal Amount, DateOnly DueDate, TuitionStatus Status);
public sealed record AbsenteeDto(Guid StudentId, string StudentName, string ClassName, DateOnly SessionDate);
public sealed record MissingHomeworkDto(Guid StudentId, string StudentName, string ClassName, DateOnly SessionDate);
public sealed record TopStudentDto(Guid StudentId, string StudentName, int RewardBalance);
public sealed record AttentionStudentDto(Guid StudentId, string StudentName, string Reason);

public sealed record DashboardChartsDto(
    IReadOnlyList<MonthRateDto> AttendanceByMonth,
    IReadOnlyList<MonthRateDto> HomeworkByMonth,
    IReadOnlyList<ClassPointsDto> RewardPointsByClass,
    IReadOnlyList<MonthScoreDto> TestScoreGrowth);

public sealed record MonthRateDto(string Month, decimal Rate);
public sealed record ClassPointsDto(string ClassName, int Points);
public sealed record MonthScoreDto(string Month, decimal AverageScore);
