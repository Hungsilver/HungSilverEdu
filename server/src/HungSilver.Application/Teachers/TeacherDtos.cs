using HungSilver.Application.Classes;

namespace HungSilver.Application.Teachers;

public sealed record TeacherProfileDto(
    Guid Id,
    string TeacherCode,
    string FullName,
    string? Phone,
    string? Email,
    DateOnly? DateOfBirth,
    string? Address,
    string? Note,
    Guid? UserId,
    string? UserName,
    bool IsLocked,
    bool MustChangePassword,
    Guid? BranchId,
    string? BranchName,
    bool IsActive,
    int ClassCount,
    bool IsDeleted,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record TeacherDetailDto(
    TeacherProfileDto Teacher,
    IReadOnlyList<ClassListItemDto> Classes);

public sealed record CreateTeacherRequest(
    string? TeacherCode,
    string FullName,
    string? Phone,
    string? Email,
    DateOnly? DateOfBirth,
    string? Address,
    string? Note,
    Guid? UserId,
    Guid? BranchId,
    bool IsActive = true);

public sealed record UpdateTeacherRequest(
    string TeacherCode,
    string FullName,
    string? Phone,
    string? Email,
    DateOnly? DateOfBirth,
    string? Address,
    string? Note,
    Guid? UserId,
    Guid? BranchId,
    bool IsActive);

public sealed record LinkAccountRequest(Guid UserId);

public sealed record UnlinkedUserDto(Guid Id, string UserName, string? FullName);

/// <summary>Tạo hồ sơ GV mới (hoặc dùng hồ sơ có sẵn) + cấp tài khoản. Tên đăng nhập = Mã GV (tự sinh);
/// mật khẩu trống ⇒ dùng mật khẩu mặc định; bắt buộc đổi ở lần đăng nhập đầu.</summary>
public sealed record CreateTeacherAccountRequest(
    Guid? TeacherProfileId,
    string? TeacherCode,
    string FullName,
    string? Phone,
    string? Email,
    DateOnly? DateOfBirth,
    string? Address,
    string? Note,
    Guid? BranchId,
    string? LoginEmail,
    string? Password);
