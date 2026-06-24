namespace HungSilver.Application.Branches;

public sealed record BranchDto(
    Guid Id,
    string Code,
    string Name,
    string? Address,
    string? Phone,
    string? TeacherCodePrefix,
    int IndexOrder,
    bool IsActive,
    bool IsDeleted,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record CreateBranchRequest(string? Code, string Name, string? Address, string? Phone, string? TeacherCodePrefix, int IndexOrder, bool IsActive = true);

public sealed record UpdateBranchRequest(string? Code, string Name, string? Address, string? Phone, string? TeacherCodePrefix, int IndexOrder, bool IsActive);
