using FluentValidation;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Application.Common.Models;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.Materials;

public interface IMaterialService
{
    Task<Result<PagedResult<MaterialDto>>> GetPagedAsync(
        MaterialListFilter filter, PagedRequest paging, CancellationToken ct = default);
    Task<Result<MaterialDto>> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Result<MaterialDto>> CreateAsync(CreateMaterialRequest request, CancellationToken ct = default);
    Task<Result<MaterialDto>> UpdateAsync(Guid id, UpdateMaterialRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
}

public sealed class MaterialService(
    IRepository<LearningMaterial> materials,
    IRepository<Subject> subjects,
    IRepository<StoredFile> storedFiles,
    IRepository<MaterialFolder> folders,
    IRepository<MaterialUnit> units,
    IRepository<Exam> exams,
    ICurrentRelationCleanupService relationCleanup,
    IUnitOfWork unitOfWork,
    IValidator<CreateMaterialRequest> createValidator,
    IValidator<UpdateMaterialRequest> updateValidator) : IMaterialService
{
    private static readonly Error NotFoundError = Error.NotFound("Material.NotFound", "Không tìm thấy tài liệu.");
    private static readonly Error FolderNotFound = Error.Validation("Material.FolderNotFound", "Không tìm thấy bộ tài liệu.");

    /// <summary>Danh sách tài liệu (phân trang) — lọc môn/khối/bộ/unit hoặc chỉ tài liệu chung + search Mã/Tên, mới nhất trước.</summary>
    public async Task<Result<PagedResult<MaterialDto>>> GetPagedAsync(
        MaterialListFilter filter, PagedRequest paging, CancellationToken ct = default)
    {
        var subj = Normalize(filter.SubjectId);
        var band = CleanBand(filter.GradeBand);
        var folderId = Normalize(filter.FolderId);
        var generalOnly = folderId == null && filter.GeneralOnly; // FolderId cụ thể thì bỏ qua GeneralOnly
        var unitId = Normalize(filter.UnitId);
        var noUnit = unitId == null && filter.NoUnit; // UnitId cụ thể thì bỏ qua NoUnit
        var term = string.IsNullOrWhiteSpace(paging.Search) ? null : paging.Search.Trim().ToLower();

        var paged = await materials.GetPagedAsync(paging.Page, paging.PageSize,
            m => (subj == null || m.SubjectId == subj)
                 && (band == null || m.GradeBand == band)
                 && (folderId == null || m.FolderId == folderId)
                 && (!generalOnly || m.FolderId == null)
                 && (unitId == null || m.UnitId == unitId)
                 && (!noUnit || m.UnitId == null)
                 && (term == null || m.Title.ToLower().Contains(term) || m.Code.ToLower().Contains(term)), ct: ct);

        var fileNames = await LoadFileNamesAsync(paged.Items, ct);
        var examCounts = await MaterialExamCounter.CountByMaterialAsync(exams, paged.Items.Select(m => m.Id), ct);
        return paged.Map(m => ToDto(m, Lookup(fileNames, m.StoredFileId), examCounts.GetValueOrDefault(m.Id)));
    }

    public async Task<Result<MaterialDto>> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var material = await materials.GetByIdAsync(id, ct: ct);
        if (material is null)
            return Result.Failure<MaterialDto>(NotFoundError);

        return ToDto(material, await FileNameAsync(material.StoredFileId, ct), await ExamCountAsync(id, ct));
    }

    public async Task<Result<MaterialDto>> CreateAsync(CreateMaterialRequest request, CancellationToken ct = default)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<MaterialDto>(validation.ToError("Material.Validation"));

        var context = await ResolveFolderContextAsync(request.FolderId, request.SubjectId, request.GradeBand, ct);
        if (context.IsFailure)
            return Result.Failure<MaterialDto>(context.Error);
        var (folderId, subjectId, subjectName, gradeBand) = context.Value;

        var unitId = await ResolveUnitAsync(folderId, request.UnitId, ct);
        if (unitId.IsFailure)
            return Result.Failure<MaterialDto>(unitId.Error);

        var cover = await CoverFileResolver.ResolveAsync(storedFiles, request.CoverFileId, ct);
        if (cover.IsFailure)
            return Result.Failure<MaterialDto>(cover.Error);

        var material = new LearningMaterial
        {
            Code = await NextCodeAsync(ct),
            FolderId = folderId,
            UnitId = unitId.Value,
            SubjectId = subjectId,
            SubjectName = subjectName,
            GradeBand = gradeBand,
            Title = request.Title.Trim(),
            Source = request.Source,
            Url = request.Source == MaterialSource.ExternalUrl ? request.Url?.Trim() : null,
            StoredFileId = request.Source == MaterialSource.ServerFile ? request.StoredFileId : null,
            CoverFileId = cover.Value,
            Description = request.Description?.Trim()
        };

        await materials.AddAsync(material, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(material, await FileNameAsync(material.StoredFileId, ct), 0);
    }

    public async Task<Result<MaterialDto>> UpdateAsync(Guid id, UpdateMaterialRequest request, CancellationToken ct = default)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<MaterialDto>(validation.ToError("Material.Validation"));

        var material = await materials.GetByIdAsync(id, ct: ct);
        if (material is null)
            return Result.Failure<MaterialDto>(NotFoundError);

        var context = await ResolveFolderContextAsync(request.FolderId, request.SubjectId, request.GradeBand, ct);
        if (context.IsFailure)
            return Result.Failure<MaterialDto>(context.Error);
        var (folderId, subjectId, subjectName, gradeBand) = context.Value;

        var unitId = await ResolveUnitAsync(folderId, request.UnitId, ct);
        if (unitId.IsFailure)
            return Result.Failure<MaterialDto>(unitId.Error);

        var cover = await CoverFileResolver.ResolveAsync(storedFiles, request.CoverFileId, ct);
        if (cover.IsFailure)
            return Result.Failure<MaterialDto>(cover.Error);

        material.FolderId = folderId;
        material.UnitId = unitId.Value;
        material.SubjectId = subjectId;
        material.SubjectName = subjectName;
        material.GradeBand = gradeBand;
        material.Title = request.Title.Trim();
        material.Source = request.Source;
        material.Url = request.Source == MaterialSource.ExternalUrl ? request.Url?.Trim() : null;
        material.StoredFileId = request.Source == MaterialSource.ServerFile ? request.StoredFileId : null;
        material.CoverFileId = cover.Value; // đổi/xóa ảnh KHÔNG xóa file cũ — orphan để FileCleanupService dọn
        material.Description = request.Description?.Trim();
        // Code giữ nguyên — mã không cho sửa.

        materials.Update(material);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(material, await FileNameAsync(material.StoredFileId, ct), await ExamCountAsync(id, ct));
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var material = await materials.GetByIdAsync(id, ct: ct);
        if (material is null)
            return Result.Failure(NotFoundError);

        await relationCleanup.NullAssignmentsForMaterialAsync(id, ct);
        materials.SoftDelete(material);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }

    /// <summary>
    /// Sinh mã TL0001 tăng dần: xuất phát từ tổng số bản ghi (kể cả đã xóa mềm — khớp backfill migration,
    /// mã không tái cấp) rồi dò mã trống kế tiếp; unique index chặn trùng do đua, fallback base36 luôn duy nhất.
    /// </summary>
    private async Task<string> NextCodeAsync(CancellationToken ct)
    {
        var total = (await materials.GetPagedAsync(1, 1, includeDeleted: true, ct: ct)).TotalCount;
        for (var next = total + 1; next <= total + 50; next++)
        {
            var candidate = $"TL{next:D4}";
            if (!await materials.AnyAsync(m => m.Code == candidate, ct, includeDeleted: true))
                return candidate;
        }
        return UniqueCodeGenerator.Next("TL");
    }

    /// <summary>
    /// Giải ngữ cảnh Môn/Khối theo bộ tài liệu: có FolderId ⇒ snapshot SubjectId/SubjectName/GradeBand
    /// TỪ BỘ (bỏ qua giá trị client gửi — chống lệch snapshot); không có ⇒ như tài liệu chung.
    /// </summary>
    private async Task<Result<(Guid? FolderId, Guid? SubjectId, string? SubjectName, string? GradeBand)>> ResolveFolderContextAsync(
        Guid? requestFolderId, Guid? requestSubjectId, string? requestGradeBand, CancellationToken ct)
    {
        var folderId = Normalize(requestFolderId);
        if (folderId is not null)
        {
            var folder = await folders.GetByIdAsync(folderId.Value, ct: ct);
            if (folder is null)
                return Result.Failure<(Guid?, Guid?, string?, string?)>(FolderNotFound);
            return (folderId, folder.SubjectId, folder.SubjectName, folder.GradeBand);
        }

        var subjectId = Normalize(requestSubjectId);
        return (folderId, subjectId, await SubjectNameAsync(subjectId, ct), CleanBand(requestGradeBand));
    }

    /// <summary>UnitId chỉ có nghĩa khi tài liệu thuộc bộ (có FolderId) và unit phải thuộc đúng bộ đó;
    /// tài liệu chung (FolderId null) ⇒ ép UnitId null.</summary>
    private async Task<Result<Guid?>> ResolveUnitAsync(Guid? folderId, Guid? requestUnitId, CancellationToken ct)
    {
        var unitId = Normalize(requestUnitId);
        if (unitId is null || folderId is null)
            return Result.Success<Guid?>(null);

        var unit = await units.GetByIdAsync(unitId.Value, ct: ct);
        if (unit is null || unit.FolderId != folderId.Value)
            return Result.Failure<Guid?>(Error.Validation("Material.UnitNotInFolder", "Unit không thuộc bộ tài liệu đã chọn."));
        return Result.Success<Guid?>(unitId);
    }

    private static Guid? Normalize(Guid? id) => id is null || id == Guid.Empty ? null : id;

    private static string? CleanBand(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private async Task<Dictionary<Guid, string>> LoadFileNamesAsync(IEnumerable<LearningMaterial> items, CancellationToken ct)
    {
        var ids = items.Where(m => m.StoredFileId.HasValue).Select(m => m.StoredFileId!.Value).Distinct().ToList();
        if (ids.Count == 0) return [];
        var files = await storedFiles.FindAsync(f => ids.Contains(f.Id), ct);
        return files.ToDictionary(f => f.Id, f => f.FileName);
    }

    private async Task<int> ExamCountAsync(Guid materialId, CancellationToken ct) =>
        (await MaterialExamCounter.CountByMaterialAsync(exams, [materialId], ct)).GetValueOrDefault(materialId);

    private async Task<string?> FileNameAsync(Guid? storedFileId, CancellationToken ct) =>
        storedFileId is null ? null : (await storedFiles.GetByIdAsync(storedFileId.Value, ct: ct))?.FileName;

    private async Task<string?> SubjectNameAsync(Guid? subjectId, CancellationToken ct) =>
        subjectId is null ? null : (await subjects.GetByIdAsync(subjectId.Value, ct: ct))?.Name;

    private static string? Lookup(Dictionary<Guid, string> map, Guid? id) =>
        id.HasValue && map.TryGetValue(id.Value, out var name) ? name : null;

    private static MaterialDto ToDto(LearningMaterial m, string? fileName, int examCount)
    {
        var downloadUrl = m.Source == MaterialSource.ServerFile && m.StoredFileId is not null
            ? $"/api/files/{m.StoredFileId}"
            : m.Url ?? string.Empty;
        return new MaterialDto(m.Id, m.Code, m.FolderId, m.UnitId, m.SubjectId, m.SubjectName, m.GradeBand,
            m.Title, m.Source, m.Url, m.StoredFileId, fileName, m.CoverFileId, m.Description, downloadUrl, examCount, m.CreatedAt);
    }
}
