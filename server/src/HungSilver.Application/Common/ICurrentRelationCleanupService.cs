using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Common;

/// <summary>
/// Dọn các quan hệ "đang hiệu lực" khi parent bị soft-delete, tránh bản ghi active bị ẩn lệch UI.
/// </summary>
public interface ICurrentRelationCleanupService
{
    Task SoftDeleteActiveEnrollmentsForStudentAsync(Guid studentId, CancellationToken ct = default);

    Task SoftDeleteInvalidActiveEnrollmentsForClassAsync(Guid classId, CancellationToken ct = default);

    Task SoftDeleteCurrentClassRelationsAsync(Guid classId, CancellationToken ct = default);

    Task<bool> HasValidActiveEnrollmentsForClassAsync(Guid classId, CancellationToken ct = default);

    Task<Dictionary<Guid, int>> LoadValidClassSizesAsync(IEnumerable<Guid> classIds, CancellationToken ct = default);

    Task<HashSet<Guid>> LoadValidActiveStudentIdsByClassesAsync(IEnumerable<Guid> classIds, CancellationToken ct = default);

    Task<Result> EnsureMaterialCategoryNotInUseAsync(Guid categoryId, CancellationToken ct = default);

    Task NullAssignmentsForMaterialAsync(Guid materialId, CancellationToken ct = default);

    Task UnlinkUserRelationsAsync(Guid userId, CancellationToken ct = default);
}
