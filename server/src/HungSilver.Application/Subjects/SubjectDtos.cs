namespace HungSilver.Application.Subjects;

public sealed record SubjectDto(
    Guid Id,
    string Name,
    string? Description,
    int SortOrder,
    bool IsActive,
    int ClassCount);

public sealed record CreateSubjectRequest(string Name, string? Description, int SortOrder, bool IsActive = true);

public sealed record UpdateSubjectRequest(string Name, string? Description, int SortOrder, bool IsActive);
