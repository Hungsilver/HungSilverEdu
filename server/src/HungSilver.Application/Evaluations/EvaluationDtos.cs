using HungSilver.Domain.Enums;

namespace HungSilver.Application.Evaluations;

public sealed record MonthlyEvaluationDto(
    Guid Id,
    Guid StudentId,
    string StudentName,
    Guid? ClassId,
    int Year,
    int Month,
    decimal AttendanceScore,
    decimal HomeworkScore,
    decimal AttitudeScore,
    decimal VocabularyScore,
    decimal GrammarScore,
    decimal Total,
    EvaluationRank Rank,
    string? Comment);

public sealed record UpsertEvaluationRequest(
    Guid StudentId,
    Guid? ClassId,
    int Year,
    int Month,
    decimal AttendanceScore,
    decimal HomeworkScore,
    decimal AttitudeScore,
    decimal VocabularyScore,
    decimal GrammarScore,
    string? Comment);

// Bảng vàng (leaderboard)
public sealed record LeaderboardDto(
    IReadOnlyList<LeaderEntry> TopReward,
    IReadOnlyList<LeaderEntry> TopAttendance,
    IReadOnlyList<LeaderEntry> TopHomework);

public sealed record LeaderEntry(Guid StudentId, string StudentName, decimal Value);
