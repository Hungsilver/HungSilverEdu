using HungSilver.Application.Abstractions;
using HungSilver.Domain.Entities;

namespace HungSilver.Application.Materials;

/// <summary>
/// Đếm số đề đã sinh theo tài liệu — dùng chung cho badge "N đề" ở tài liệu, mục lục Unit và card bộ.
/// Gom về một truy vấn theo tập materialId để tránh N+1 khi render lưới.
/// Không có khóa ngoại nên chỉ đếm theo cột <c>Exam.MaterialId</c>; đề đã xóa mềm tự bị query filter loại.
/// </summary>
public static class MaterialExamCounter
{
    public static async Task<Dictionary<Guid, int>> CountByMaterialAsync(
        IRepository<Exam> exams, IEnumerable<Guid> materialIds, CancellationToken ct = default)
    {
        var ids = materialIds.Distinct().ToList();
        if (ids.Count == 0) return [];

        var found = await exams.FindAsync(e => e.MaterialId != null && ids.Contains(e.MaterialId.Value), ct);
        return found
            .GroupBy(e => e.MaterialId!.Value)
            .ToDictionary(g => g.Key, g => g.Count());
    }
}
