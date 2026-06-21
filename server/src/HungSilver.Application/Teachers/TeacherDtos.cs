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
    bool IsActive);

public sealed record LinkAccountRequest(Guid UserId);

public sealed record UnlinkedUserDto(Guid Id, string UserName, string? FullName);

public sealed record CreateTeacherAccountRequest(
    Guid? TeacherProfileId,
    string? TeacherCode,
    string FullName,
    string? Phone,
    string? Email,
    DateOnly? DateOfBirth,
    string? Address,
    string? Note,
    string UserName,
    string? LoginEmail,
    string Password);
