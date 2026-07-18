using FluentValidation;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.Materials;

public interface IMaterialUnitService
{
    /// <summary>Danh sách unit của một bộ, đã sort SortOrder + derive số hiển thị (Unit 1/2… và Review 1/2… đếm riêng).</summary>
    Task<Result<List<MaterialUnitDto>>> GetByFolderAsync(Guid folderId, CancellationToken ct = default);
    Task<Result<MaterialUnitDto>> CreateAsync(CreateMaterialUnitRequest request, CancellationToken ct = default);
    Task<Result<MaterialUnitDto>> UpdateAsync(Guid id, UpdateMaterialUnitRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
    /// <summary>Sắp xếp lại toàn bộ unit của một bộ theo OrderedIds; trả về danh sách đã đánh số lại.</summary>
    Task<Result<List<MaterialUnitDto>>> ReorderAsync(ReorderMaterialUnitsRequest request, CancellationToken ct = default);
}

/// <summary>
/// Unit/Chương trong Bộ tài liệu (kiểu Sách Mềm). Unit thuộc bộ BẤT BIẾN sau khi tạo;
/// xóa unit bị chặn khi còn tài liệu; số hiển thị derive từ SortOrder (không lưu DB).
/// </summary>
public sealed class MaterialUnitService(
    IRepository<MaterialUnit> units,
    IRepository<MaterialFolder> folders,
    IRepository<LearningMaterial> materials,
    IUnitOfWork unitOfWork,
    IValidator<CreateMaterialUnitRequest> createValidator,
    IValidator<UpdateMaterialUnitRequest> updateValidator,
    IValidator<ReorderMaterialUnitsRequest> reorderValidator) : IMaterialUnitService
{
    private static readonly Error NotFoundError = Error.NotFound("MaterialUnit.NotFound", "Không tìm thấy unit.");

    public async Task<Result<List<MaterialUnitDto>>> GetByFolderAsync(Guid folderId, CancellationToken ct = default)
    {
        var list = await LoadOrderedAsync(folderId, ct);
        var counts = await CountMaterialsByUnitAsync(list.Select(u => u.Id).ToList(), ct);
        return ToDtos(list, counts);
    }

    public async Task<Result<MaterialUnitDto>> CreateAsync(CreateMaterialUnitRequest request, CancellationToken ct = default)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<MaterialUnitDto>(validation.ToError("MaterialUnit.Validation"));

        if (await folders.GetByIdAsync(request.FolderId, ct: ct) is null)
            return Result.Failure<MaterialUnitDto>(Error.Validation("MaterialUnit.FolderNotFound", "Không tìm thấy bộ tài liệu."));

        var siblings = await units.FindAsync(u => u.FolderId == request.FolderId, ct);
        var unit = new MaterialUnit
        {
            FolderId = request.FolderId,
            Kind = request.Kind,
            Name = request.Name?.Trim() ?? string.Empty,
            SortOrder = siblings.Count == 0 ? 0 : siblings.Max(u => u.SortOrder) + 1
        };

        await units.AddAsync(unit, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return await BuildDtoAsync(unit, ct);
    }

    public async Task<Result<MaterialUnitDto>> UpdateAsync(Guid id, UpdateMaterialUnitRequest request, CancellationToken ct = default)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<MaterialUnitDto>(validation.ToError("MaterialUnit.Validation"));

        var unit = await units.GetByIdAsync(id, ct: ct);
        if (unit is null)
            return Result.Failure<MaterialUnitDto>(NotFoundError);

        unit.Kind = request.Kind;
        unit.Name = request.Name?.Trim() ?? string.Empty;
        // FolderId/SortOrder BẤT BIẾN ở đây — bộ không đổi, thứ tự chỉ đổi qua Reorder.
        units.Update(unit);
        await unitOfWork.SaveChangesAsync(ct);
        return await BuildDtoAsync(unit, ct);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var unit = await units.GetByIdAsync(id, ct: ct);
        if (unit is null)
            return Result.Failure(NotFoundError);

        if (await materials.AnyAsync(m => m.UnitId == id, ct))
            return Result.Failure(Error.Conflict("MaterialUnit.InUse",
                "Unit vẫn còn tài liệu bên trong — hãy xóa hoặc chuyển hết tài liệu trước."));

        units.SoftDelete(unit);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result<List<MaterialUnitDto>>> ReorderAsync(ReorderMaterialUnitsRequest request, CancellationToken ct = default)
    {
        var validation = await reorderValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<List<MaterialUnitDto>>(validation.ToError("MaterialUnit.Validation"));

        var list = await LoadOrderedAsync(request.FolderId, ct);
        var byId = list.ToDictionary(u => u.Id);
        // Khớp CHÍNH XÁC tập unit đang có của bộ — chống reorder trên dữ liệu cũ (unit vừa thêm/xóa ở tab khác).
        if (request.OrderedIds.Count != list.Count
            || request.OrderedIds.Distinct().Count() != request.OrderedIds.Count
            || request.OrderedIds.Any(oid => !byId.ContainsKey(oid)))
            return Result.Failure<List<MaterialUnitDto>>(Error.Validation("MaterialUnit.ReorderInvalid",
                "Danh sách sắp xếp không khớp với các unit hiện có của bộ — hãy tải lại trang."));

        for (var i = 0; i < request.OrderedIds.Count; i++)
        {
            var unit = byId[request.OrderedIds[i]];
            unit.SortOrder = i;
            units.Update(unit);
        }
        await unitOfWork.SaveChangesAsync(ct);

        var reordered = request.OrderedIds.Select(oid => byId[oid]).ToList();
        var counts = await CountMaterialsByUnitAsync(reordered.Select(u => u.Id).ToList(), ct);
        return ToDtos(reordered, counts);
    }

    /// <summary>Unit của bộ theo thứ tự hiển thị. FindAsync mặc định sort CreatedAt desc — phải tự OrderBy lại.</summary>
    private async Task<List<MaterialUnit>> LoadOrderedAsync(Guid folderId, CancellationToken ct) =>
        (await units.FindAsync(u => u.FolderId == folderId, ct))
            .OrderBy(u => u.SortOrder).ThenBy(u => u.CreatedAt).ToList();

    private async Task<Dictionary<Guid, int>> CountMaterialsByUnitAsync(List<Guid> unitIds, CancellationToken ct)
    {
        if (unitIds.Count == 0) return [];
        var items = await materials.FindAsync(m => m.UnitId != null && unitIds.Contains(m.UnitId.Value), ct);
        return items.GroupBy(m => m.UnitId!.Value).ToDictionary(g => g.Key, g => g.Count());
    }

    /// <summary>DTO của một unit — số hiển thị phụ thuộc cả danh sách nên phải derive lại từ toàn bộ.</summary>
    private async Task<Result<MaterialUnitDto>> BuildDtoAsync(MaterialUnit unit, CancellationToken ct)
    {
        var list = await LoadOrderedAsync(unit.FolderId, ct);
        var counts = await CountMaterialsByUnitAsync(list.Select(u => u.Id).ToList(), ct);
        return ToDtos(list, counts).First(d => d.Id == unit.Id);
    }

    private static List<MaterialUnitDto> ToDtos(List<MaterialUnit> ordered, Dictionary<Guid, int> materialCounts)
    {
        var result = new List<MaterialUnitDto>(ordered.Count);
        int unitNo = 0, reviewNo = 0;
        foreach (var u in ordered)
        {
            var no = u.Kind == MaterialUnitKind.Unit ? ++unitNo : ++reviewNo;
            result.Add(new MaterialUnitDto(u.Id, u.FolderId, u.Kind, u.Name, no,
                u.SortOrder, materialCounts.GetValueOrDefault(u.Id), u.CreatedAt));
        }
        return result;
    }
}
