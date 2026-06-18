using HungSilver.Domain.Enums;

namespace HungSilver.Application.Sessions;

public sealed record SessionSheetDto(
    Guid SessionId,
    Guid ClassId,
    string ClassName,
    int SessionNumber,
    DateOnly SessionDate,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    string? Topic,
    SessionStatus Status,
    IReadOnlyList<SessionStudentRowDto> Rows);

public sealed record SessionStudentRowDto(
    Guid StudentId,
    string FullName,
    AttendanceStatus Attendance,
    HomeworkStatus Homework,
    AttitudeStatus Attitude,
    string? PersonalNote,
    int RewardBalance,
    IReadOnlyList<PointEntryDto> Points);

public sealed record PointEntryDto(
    Guid Id,
    Guid StudentId,
    PointType Type,
    int Points,
    string Reason,
    DateTime CreatedAt);

public sealed record SaveAttendanceRequest(IReadOnlyList<SaveAttendanceRow> Entries);

public sealed record SaveAttendanceRow(
    Guid StudentId,
    AttendanceStatus Attendance,
    HomeworkStatus Homework,
    AttitudeStatus Attitude,
    string? PersonalNote);

public sealed record AddPointRequest(Guid StudentId, PointType Type, int Points, string Reason);

public sealed record RedeemRewardRequest(RewardTier Tier, string? Note);

public sealed record StudentProgressDto(
    Guid StudentId,
    string FullName,
    int TotalSessions,
    int AttendedSessions,
    int AbsentSessions,
    int HomeworkCompleted,
    int HomeworkNotCompleted,
    int RewardPoints,
    int PenaltyPoints,
    int RewardBalance,
    SkillScoresDto? LatestSkills,
    IReadOnlyList<AssessmentPointDto> ScoreTrend);

public sealed record SkillScoresDto(
    decimal? Overall,
    decimal? Vocabulary,
    decimal? Grammar,
    decimal? Listening,
    decimal? Speaking,
    decimal? Reading,
    decimal? Writing);

public sealed record AssessmentPointDto(
    DateOnly TakenOn,
    decimal? Overall,
    decimal? Vocabulary,
    decimal? Grammar,
    decimal? Listening,
    decimal? Speaking,
    decimal? Reading,
    decimal? Writing);
