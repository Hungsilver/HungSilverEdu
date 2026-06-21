namespace HungSilver.Application.Students;

public sealed record StudentClassDto(
    Guid ClassId,
    string ClassCode,
    string ClassName,
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
    DateOnly EnrolledOn);

public sealed record StudentDto(
    Guid Id,
    string StudentCode,
    string FullName,
    DateOnly? DateOfBirth,
    string? School,
    string? GradeLevel,
    string? Phone,
    string? ParentName,
    string? ParentPhone,
    string? Address,
    string? Email,
    string? Note,
    DateOnly EnrollmentDate,
    string? EnglishLevel,
    string? LearningGoal,
    string? Curriculum,
    Guid? UserId,
    bool IsActive,
    bool IsDeleted,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    IReadOnlyList<StudentClassDto> Classes);

public sealed record CreateStudentRequest(
    string? StudentCode,
    string FullName,
    DateOnly? DateOfBirth,
    string? School,
    string? GradeLevel,
    string? Phone,
    string? ParentName,
    string? ParentPhone,
    string? Address,
    string? Email,
    string? Note,
    DateOnly? EnrollmentDate,
    string? EnglishLevel,
    string? LearningGoal,
    string? Curriculum,
    bool IsActive = true);

public sealed record LinkUserRequest(Guid UserId);

/// <summary>Giáo viên/Admin tạo học sinh trong lớp, kèm tùy chọn tạo tài khoản đăng nhập.</summary>
public sealed record CreateClassStudentRequest(
    string? StudentCode,
    string FullName,
    DateOnly? DateOfBirth,
    string? School,
    string? GradeLevel,
    string? Phone,
    string? ParentName,
    string? ParentPhone,
    string? Email,
    string? Note,
    string? EnglishLevel,
    string? LearningGoal,
    bool CreateAccount = false,
    string? UserName = null,
    string? Password = null);

public sealed record CreateClassStudentResultDto(
    Guid StudentId,
    string StudentCode,
    string FullName,
    bool AccountCreated,
    string? UserName);

public sealed record ResetStudentPasswordRequest(string NewPassword);

public sealed record UpdateStudentRequest(
    string? StudentCode,
    string FullName,
    DateOnly? DateOfBirth,
    string? School,
    string? GradeLevel,
    string? Phone,
    string? ParentName,
    string? ParentPhone,
    string? Address,
    string? Email,
    string? Note,
    DateOnly? EnrollmentDate,
    string? EnglishLevel,
    string? LearningGoal,
    string? Curriculum,
    bool IsActive);
