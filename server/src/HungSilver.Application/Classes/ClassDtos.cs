namespace HungSilver.Application.Classes;

public sealed record ClassDto(
    Guid Id,
    string Name,
    Guid TeacherId,
    string? TeacherName,
    Guid? SubjectId,
    string? SubjectName,
    string? GradeBand,
    Guid? CurriculumId,
    string? CurriculumName,
    int MaxCapacity,
    string? Schedule,
    DateOnly? StartDate,
    bool IsActive,
    int CurrentSize,
    decimal? AverageScore,
    decimal AttendanceRate,
    bool IsDeleted,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record ClassListItemDto(
    Guid Id,
    string Name,
    Guid TeacherId,
    string? TeacherName,
    Guid? SubjectId,
    string? SubjectName,
    string? GradeBand,
    int MaxCapacity,
    int CurrentSize,
    bool IsActive,
    bool IsDeleted,
    DateTime CreatedAt);

public sealed record CreateClassRequest(
    string Name,
    Guid TeacherId,
    Guid? SubjectId,
    string? GradeBand,
    Guid? CurriculumId,
    int MaxCapacity,
    string? Schedule,
    DateOnly? StartDate,
    bool IsActive = true);

public sealed record UpdateClassRequest(
    string Name,
    Guid TeacherId,
    Guid? SubjectId,
    string? GradeBand,
    Guid? CurriculumId,
    int MaxCapacity,
    string? Schedule,
    DateOnly? StartDate,
    bool IsActive);

public sealed record AssignTeacherRequest(Guid TeacherId);

public sealed record EnrollStudentRequest(Guid StudentId);

public sealed record RosterItemDto(
    Guid EnrollmentId,
    Guid StudentId,
    string FullName,
    string? Phone,
    string? ParentPhone,
    DateOnly EnrolledOn,
    Guid? UserId);

/// <summary>Tình hình học tập từng học sinh trong lớp (điểm thưởng/phạt, chuyên cần, BTVN).</summary>
public sealed record ClassStudentOverviewDto(
    Guid StudentId,
    string FullName,
    int RewardBalance,
    int AttendedSessions,
    int TotalRecords,
    decimal AttendanceRate,
    int HomeworkCompleted,
    int HomeworkAssigned,
    decimal HomeworkRate);
