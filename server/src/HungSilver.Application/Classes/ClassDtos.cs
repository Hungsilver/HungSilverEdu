namespace HungSilver.Application.Classes;

public sealed record ClassDto(
    Guid Id,
    string ClassCode,
    string Name,
    Guid? TeacherProfileId,
    string? TeacherName,
    Guid? BranchId,
    string? BranchCode,
    string? BranchName,
    Guid? SubjectId,
    string? SubjectName,
    Guid? GradeId,
    string? GradeName,
    decimal TuitionFee,
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
    string ClassCode,
    string Name,
    Guid? TeacherProfileId,
    string? TeacherName,
    Guid? BranchId,
    string? BranchCode,
    string? BranchName,
    Guid? SubjectId,
    string? SubjectName,
    Guid? GradeId,
    string? GradeName,
    decimal TuitionFee,
    int MaxCapacity,
    int CurrentSize,
    bool IsActive,
    bool IsDeleted,
    DateTime CreatedAt);

public sealed record CreateClassRequest(
    string? ClassCode,
    string Name,
    Guid TeacherProfileId,
    Guid? BranchId,
    Guid? SubjectId,
    Guid? GradeId,
    decimal TuitionFee,
    Guid? CurriculumId,
    int MaxCapacity,
    string? Schedule,
    DateOnly? StartDate,
    bool IsActive = true);

public sealed record UpdateClassRequest(
    string? ClassCode,
    string Name,
    Guid TeacherProfileId,
    Guid? BranchId,
    Guid? SubjectId,
    Guid? GradeId,
    decimal TuitionFee,
    Guid? CurriculumId,
    int MaxCapacity,
    string? Schedule,
    DateOnly? StartDate,
    bool IsActive);

public sealed record AssignTeacherRequest(Guid TeacherProfileId);

public sealed record EnrollStudentRequest(Guid StudentId);

public sealed record RosterItemDto(
    Guid EnrollmentId,
    Guid StudentId,
    string StudentCode,
    string FullName,
    string? Phone,
    string? ParentPhone,
    string? Email,
    string? Note,
    DateOnly EnrolledOn,
    Guid? UserId,
    string? UserName = null,
    bool IsLocked = false);

/// <summary>Tình hình học tập từng học sinh trong lớp (điểm thưởng/phạt, chuyên cần, BTVN).</summary>
public sealed record ClassStudentOverviewDto(
    Guid StudentId,
    string StudentCode,
    string FullName,
    int RewardBalance,
    int AttendedSessions,
    int TotalRecords,
    decimal AttendanceRate,
    int HomeworkCompleted,
    int HomeworkAssigned,
    decimal HomeworkRate);
