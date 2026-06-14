namespace HungSilver.Application.Students;

public sealed record StudentDto(
    Guid Id,
    string FullName,
    DateOnly? DateOfBirth,
    string? School,
    string? GradeLevel,
    string? Phone,
    string? ParentName,
    string? ParentPhone,
    string? Address,
    DateOnly EnrollmentDate,
    string? EnglishLevel,
    string? LearningGoal,
    decimal? EntryScore,
    string? Curriculum,
    Guid? UserId,
    bool IsActive,
    bool IsDeleted,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc);

public sealed record CreateStudentRequest(
    string FullName,
    DateOnly? DateOfBirth,
    string? School,
    string? GradeLevel,
    string? Phone,
    string? ParentName,
    string? ParentPhone,
    string? Address,
    DateOnly? EnrollmentDate,
    string? EnglishLevel,
    string? LearningGoal,
    decimal? EntryScore,
    string? Curriculum,
    bool IsActive = true);

public sealed record LinkUserRequest(Guid UserId);

public sealed record UpdateStudentRequest(
    string FullName,
    DateOnly? DateOfBirth,
    string? School,
    string? GradeLevel,
    string? Phone,
    string? ParentName,
    string? ParentPhone,
    string? Address,
    DateOnly? EnrollmentDate,
    string? EnglishLevel,
    string? LearningGoal,
    decimal? EntryScore,
    string? Curriculum,
    bool IsActive);
