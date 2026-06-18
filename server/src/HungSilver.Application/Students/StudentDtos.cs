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
    DateTime CreatedAt,
    DateTime? UpdatedAt);

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

/// <summary>Giáo viên tạo học sinh trong lớp của mình, kèm tùy chọn tạo tài khoản đăng nhập.</summary>
public sealed record CreateClassStudentRequest(
    string FullName,
    DateOnly? DateOfBirth,
    string? School,
    string? GradeLevel,
    string? Phone,
    string? ParentName,
    string? ParentPhone,
    string? EnglishLevel,
    string? LearningGoal,
    bool CreateAccount = false,
    string? UserName = null,
    string? Password = null);

public sealed record CreateClassStudentResultDto(
    Guid StudentId,
    string FullName,
    bool AccountCreated,
    string? UserName);

public sealed record ResetStudentPasswordRequest(string NewPassword);

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
