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
        Guid? subjectId, Guid? categoryId, string? gradeBand, PagedRequest paging, CancellationToken ct = default);
    Task<Result<MaterialDto>> CreateAsync(CreateMaterialRequest request, CancellationToken ct = default);
    Task<Result<MaterialDto>> UpdateAsync(Guid id, UpdateMaterialRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
}

public sealed class MaterialService(
    IRepository<LearningMaterial> materials,
    IRepository<MaterialCategory> categories,
    IRepository<Subject> subjects,
    IRepository<StoredFile> storedFiles,
    IClassAccessGuard accessGuard,
    ICurrentRelationCleanupService relationCleanup,
    IUnitOfWork unitOfWork,
    ICurrentUser currentUser,
    IValidator<CreateMaterialRequest> createValidator,
    IValidator<UpdateMaterialRequest> updateValidator) : IMaterialService
{
    private static readonly Error NotFoundError = Error.NotFound("Material.NotFound", "Không tìm thấy tài liệu.");
    private static readonly Error CoverNotFound = Error.Validation("Material.CoverNotFound", "Không tìm thấy ảnh bìa đã tải lên — hãy tải lại ảnh.");
    private static readonly Error CoverNotImage = Error.Validation("Material.CoverNotImage", "Ảnh bìa phải là file ảnh.");

    /// <summary>Danh sách TẤT CẢ tài liệu (phân trang) — lọc theo môn/loại/khối + search Mã/Tên, mới nhất trước.</summary>
    public async Task<Result<PagedResult<MaterialDto>>> GetPagedAsync(
        Guid? subjectId, Guid? categoryId, string? gradeBand, PagedRequest paging, CancellationToken ct = default)
    {
        var subj = Normalize(subjectId);
        var cat = Normalize(categoryId);
        var band = CleanBand(gradeBand);
        var term = string.IsNullOrWhiteSpace(paging.Search) ? null : paging.Search.Trim().ToLower();

        var paged = await materials.GetPagedAsync(paging.Page, paging.PageSize,
            m => (subj == null || m.SubjectId == subj)
                 && (cat == null || m.CategoryId == cat)
                 && (band == null || m.GradeBand == band)
                 && (term == null || m.Title.ToLower().Contains(term) || m.Code.ToLower().Contains(term)), ct: ct);

        var categoryNames = await LoadCategoryNamesAsync(paged.Items, ct);
        var fileNames = await LoadFileNamesAsync(paged.Items, ct);
        return paged.Map(m => ToDto(m, Lookup(categoryNames, m.CategoryId), Lookup(fileNames, m.StoredFileId)));
    }

    public async Task<Result<MaterialDto>> CreateAsync(CreateMaterialRequest request, CancellationToken ct = default)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<MaterialDto>(validation.ToError("Material.Validation"));

        var subjectId = Normalize(request.SubjectId);
        var subjectName = await SubjectNameAsync(subjectId, ct);

        var cover = await ResolveCoverAsync(request.CoverFileId, ct);
        if (cover.IsFailure)
            return Result.Failure<MaterialDto>(cover.Error);

        var material = new LearningMaterial
        {
            Code = await NextCodeAsync(ct),
            CategoryId = Normalize(request.CategoryId),
            SubjectId = subjectId,
            SubjectName = subjectName,
            GradeBand = CleanBand(request.GradeBand),
            Title = request.Title.Trim(),
            Type = MaterialType.Pdf, // enum legacy — UI không dùng nữa, giữ giá trị mặc định
            Source = request.Source,
            Url = request.Source == MaterialSource.ExternalUrl ? request.Url?.Trim() : null,
            StoredFileId = request.Source == MaterialSource.ServerFile ? request.StoredFileId : null,
            CoverFileId = cover.Value,
            Description = request.Description?.Trim(),
            UploadedByUserId = currentUser.UserId
        };

        await materials.AddAsync(material, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(material, await CategoryNameAsync(material.CategoryId, ct), await FileNameAsync(material.StoredFileId, ct));
    }

    public async Task<Result<MaterialDto>> UpdateAsync(Guid id, UpdateMaterialRequest request, CancellationToken ct = default)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<MaterialDto>(validation.ToError("Material.Validation"));

        var material = await materials.GetByIdAsync(id, ct: ct);
        if (material is null)
            return Result.Failure<MaterialDto>(NotFoundError);

        // Bản ghi cũ còn gắn lớp ⇒ vẫn kiểm quyền lớp (thiết kế mới không tạo ClassId nữa).
        if (material.ClassId is not null)
        {
            var access = await accessGuard.EnsureCanAccessClassAsync(material.ClassId.Value, ct);
            if (access.IsFailure)
                return Result.Failure<MaterialDto>(access.Error);
        }

        var cover = await ResolveCoverAsync(request.CoverFileId, ct);
        if (cover.IsFailure)
            return Result.Failure<MaterialDto>(cover.Error);

        material.CategoryId = Normalize(request.CategoryId);
        material.SubjectId = Normalize(request.SubjectId);
        material.SubjectName = await SubjectNameAsync(material.SubjectId, ct);
        material.GradeBand = CleanBand(request.GradeBand);
        material.Title = request.Title.Trim();
        material.Source = request.Source;
        material.Url = request.Source == MaterialSource.ExternalUrl ? request.Url?.Trim() : null;
        material.StoredFileId = request.Source == MaterialSource.ServerFile ? request.StoredFileId : null;
        material.CoverFileId = cover.Value; // đổi/xóa ảnh KHÔNG xóa file cũ — orphan để FileCleanupService dọn
        material.Description = request.Description?.Trim();
        // Code/Type giữ nguyên — mã không cho sửa.

        materials.Update(material);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(material, await CategoryNameAsync(material.CategoryId, ct), await FileNameAsync(material.StoredFileId, ct));
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var material = await materials.GetByIdAsync(id, ct: ct);
        if (material is null)
            return Result.Failure(NotFoundError);

        if (material.ClassId is not null)
        {
            var access = await accessGuard.EnsureCanAccessClassAsync(material.ClassId.Value, ct);
            if (access.IsFailure)
                return access;
        }

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

    /// <summary>Kiểm tra CoverFileId (nếu có): StoredFile tồn tại và là ảnh. Trả về id đã Normalize.</summary>
    private async Task<Result<Guid?>> ResolveCoverAsync(Guid? coverFileId, CancellationToken ct)
    {
        var cover = Normalize(coverFileId);
        if (cover is null) return Result.Success<Guid?>(null);
        var file = await storedFiles.GetByIdAsync(cover.Value, ct: ct);
        if (file is null) return Result.Failure<Guid?>(CoverNotFound);
        if (!file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return Result.Failure<Guid?>(CoverNotImage);
        return Result.Success<Guid?>(cover);
    }

    private static Guid? Normalize(Guid? id) => id is null || id == Guid.Empty ? null : id;

    private static string? CleanBand(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private async Task<Dictionary<Guid, string>> LoadCategoryNamesAsync(IEnumerable<LearningMaterial> items, CancellationToken ct)
    {
        var ids = items.Where(m => m.CategoryId.HasValue).Select(m => m.CategoryId!.Value).Distinct().ToList();
        if (ids.Count == 0) return [];
        var cats = await categories.FindAsync(c => ids.Contains(c.Id), ct);
        return cats.ToDictionary(c => c.Id, c => c.Name);
    }

    private async Task<Dictionary<Guid, string>> LoadFileNamesAsync(IEnumerable<LearningMaterial> items, CancellationToken ct)
    {
        var ids = items.Where(m => m.StoredFileId.HasValue).Select(m => m.StoredFileId!.Value).Distinct().ToList();
        if (ids.Count == 0) return [];
        var files = await storedFiles.FindAsync(f => ids.Contains(f.Id), ct);
        return files.ToDictionary(f => f.Id, f => f.FileName);
    }

    private async Task<string?> CategoryNameAsync(Guid? categoryId, CancellationToken ct) =>
        categoryId is null ? null : (await categories.GetByIdAsync(categoryId.Value, ct: ct))?.Name;

    private async Task<string?> FileNameAsync(Guid? storedFileId, CancellationToken ct) =>
        storedFileId is null ? null : (await storedFiles.GetByIdAsync(storedFileId.Value, ct: ct))?.FileName;

    private async Task<string?> SubjectNameAsync(Guid? subjectId, CancellationToken ct) =>
        subjectId is null ? null : (await subjects.GetByIdAsync(subjectId.Value, ct: ct))?.Name;

    private static string? Lookup(Dictionary<Guid, string> map, Guid? id) =>
        id.HasValue && map.TryGetValue(id.Value, out var name) ? name : null;

    private static MaterialDto ToDto(LearningMaterial m, string? categoryName, string? fileName)
    {
        var downloadUrl = m.Source == MaterialSource.ServerFile && m.StoredFileId is not null
            ? $"/api/files/{m.StoredFileId}"
            : m.Url ?? string.Empty;
        return new MaterialDto(m.Id, m.Code, m.ClassId, m.CategoryId, categoryName, m.SubjectId, m.SubjectName, m.GradeBand,
            m.Title, m.Source, m.Url, m.StoredFileId, fileName, m.CoverFileId, m.Description, downloadUrl, m.CreatedAt);
    }
}
