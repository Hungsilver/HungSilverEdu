using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.Materials;

/// <summary>
/// Lượt giao tài liệu cho lớp (phía GV). Source/Url/StoredFileId/FileName resolve LIVE từ Kho —
/// tài liệu đã xóa mềm ⇒ <c>MaterialDeleted=true</c> và hiển thị bằng snapshot <c>MaterialTitle</c>.
/// </summary>
public sealed record MaterialAssignmentDto(
    Guid Id,
    Guid MaterialId,
    string MaterialTitle,
    bool MaterialDeleted,
    Guid ClassId,
    string ClassName,
    Guid? ClassSessionId,
    string? Note,
    MaterialSource Source,
    string? Url,
    Guid? StoredFileId,
    string? FileName,
    int ViewedCount,
    int TotalStudents,
    DateTime CreatedAt);

public sealed record AssignMaterialRequest(
    Guid ClassId,
    Guid? ClassSessionId,
    string? Note);

/// <summary>Trạng thái xem của từng học viên trong một lượt giao (IsActive=false: đã rời lớp nhưng từng xem).</summary>
public sealed record MaterialAssignmentViewerDto(
    Guid StudentId,
    string FullName,
    DateTime? ViewedAt,
    bool IsActive);

/// <summary>Tài liệu được giao — góc nhìn học viên (Portal).</summary>
public sealed record PortalMaterialDto(
    Guid AssignmentId,
    Guid MaterialId,
    string Title,
    string ClassName,
    string? Note,
    MaterialSource Source,
    string? Url,
    Guid? StoredFileId,
    string? FileName,
    bool Viewed,
    DateTime AssignedAt);

public interface IMaterialAssignmentService
{
    Task<Result<MaterialAssignmentDto>> AssignAsync(Guid materialId, AssignMaterialRequest request, CancellationToken ct = default);
    Task<Result<List<MaterialAssignmentDto>>> ListByClassAsync(Guid classId, CancellationToken ct = default);
    Task<Result<List<MaterialAssignmentDto>>> ListBySessionAsync(Guid sessionId, CancellationToken ct = default);
    Task<Result> RemoveAsync(Guid assignmentId, CancellationToken ct = default);
    Task<Result<List<MaterialAssignmentViewerDto>>> GetViewersAsync(Guid assignmentId, CancellationToken ct = default);
}

public interface IPortalMaterialService
{
    Task<Result<List<PortalMaterialDto>>> GetMyMaterialsAsync(CancellationToken ct = default);
    Task<Result> MarkViewedAsync(Guid assignmentId, CancellationToken ct = default);
}
