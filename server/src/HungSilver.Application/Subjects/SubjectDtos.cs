namespace HungSilver.Application.Subjects;

public sealed record SubjectDto(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    int IndexOrder,
    bool IsActive);

public sealed record CreateSubjectRequest(string? Code, string Name, string? Description, int IndexOrder, bool IsActive = true);

public sealed record UpdateSubjectRequest(string? Code, string Name, string? Description, int IndexOrder, bool IsActive);
