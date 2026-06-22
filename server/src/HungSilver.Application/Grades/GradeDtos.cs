namespace HungSilver.Application.Grades;

public sealed record GradeDto(
    Guid Id,
    string Code,
    string Name,
    int IndexOrder,
    bool IsActive,
    bool IsDeleted,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record CreateGradeRequest(string? Code, string Name, int IndexOrder, bool IsActive = true);

public sealed record UpdateGradeRequest(string? Code, string Name, int IndexOrder, bool IsActive);
