using FluentValidation;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.Materials;

public interface IMaterialService
{
    Task<Result<List<MaterialDto>>> GetByClassAsync(Guid classId, CancellationToken ct = default);
    Task<Result<List<MaterialDto>>> GetLibraryAsync(Guid? categoryId, MaterialType? type, string? gradeBand, CancellationToken ct = default);
    Task<Result<MaterialDto>> CreateAsync(CreateMaterialRequest request, CancellationToken ct = default);
    Task<Result<MaterialDto>> UpdateAsync(Guid id, UpdateMaterialRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
}

public sealed class MaterialService(
    IRepository<LearningMaterial> materials,
    IRepository<MaterialCategory> categories,
    IClassAccessGuard accessGuard,
    IUnitOfWork unitOfWork,
    ICurrentUser currentUser,
    IValidator<CreateMaterialRequest> createValidator,
    IValidator<UpdateMaterialRequest> updateValidator) : IMaterialService
{
    private static readonly Error NotFoundError = Error.NotFound("Material.NotFound", "Không tìm thấy tài liệu.");

    public async Task<Result<List<MaterialDto>>> GetByClassAsync(Guid classId, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessClassAsync(classId, ct);
        if (access.IsFailure)
            return Result.Failure<List<MaterialDto>>(access.Error);

        var items = await materials.FindAsync(m => m.ClassId == classId, ct);
        var names = await LoadCategoryNamesAsync(items, ct);
        return items.OrderByDescending(m => m.CreatedAt).Select(m => ToDto(m, Lookup(names, m.CategoryId))).ToList();
    }

    /// <summary>Thư viện học liệu chung (không gắn lớp), lọc theo danh mục/loại/khối.</summary>
    public async Task<Result<List<MaterialDto>>> GetLibraryAsync(Guid? categoryId, MaterialType? type, string? gradeBand, CancellationToken ct = default)
    {
        var band = string.IsNullOrWhiteSpace(gradeBand) ? null : gradeBand.Trim();
        var items = await materials.FindAsync(
            m => m.ClassId == null
                 && (categoryId == null || m.CategoryId == categoryId)
                 && (type == null || m.Type == type)
                 && (band == null || m.GradeBand == band), ct);
        var names = await LoadCategoryNamesAsync(items, ct);
        return items.OrderByDescending(m => m.CreatedAt).Select(m => ToDto(m, Lookup(names, m.CategoryId))).ToList();
    }

    public async Task<Result<MaterialDto>> CreateAsync(CreateMaterialRequest request, CancellationToken ct = default)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<MaterialDto>(validation.ToError("Material.Validation"));

        var classId = Normalize(request.ClassId);
        if (classId is not null)
        {
            var access = await accessGuard.EnsureCanAccessClassAsync(classId.Value, ct);
            if (access.IsFailure)
                return Result.Failure<MaterialDto>(access.Error);
        }

        var material = new LearningMaterial
        {
            ClassId = classId,
            CategoryId = Normalize(request.CategoryId),
            GradeBand = CleanBand(request.GradeBand),
            Title = request.Title.Trim(),
            Type = request.Type,
            Source = request.Source,
            Url = request.Source == MaterialSource.ExternalUrl ? request.Url?.Trim() : null,
            StoredFileId = request.Source == MaterialSource.ServerFile ? request.StoredFileId : null,
            Description = request.Description?.Trim(),
            UploadedByUserId = currentUser.UserId
        };

        await materials.AddAsync(material, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(material, await CategoryNameAsync(material.CategoryId, ct));
    }

    public async Task<Result<MaterialDto>> UpdateAsync(Guid id, UpdateMaterialRequest request, CancellationToken ct = default)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<MaterialDto>(validation.ToError("Material.Validation"));

        var material = await materials.GetByIdAsync(id, ct: ct);
        if (material is null)
            return Result.Failure<MaterialDto>(NotFoundError);

        // Học liệu gắn lớp ⇒ kiểm quyền lớp; học liệu thư viện ⇒ TeacherOrAdmin (đã ở controller).
        if (material.ClassId is not null)
        {
            var access = await accessGuard.EnsureCanAccessClassAsync(material.ClassId.Value, ct);
            if (access.IsFailure)
                return Result.Failure<MaterialDto>(access.Error);
        }
        else if (Normalize(request.CategoryId) is null)
        {
            // Học liệu thư viện (không thuộc lớp) bắt buộc giữ danh mục, tránh "mồ côi".
            return Result.Failure<MaterialDto>(Error.Validation("Material.CategoryRequired", "Học liệu thư viện cần thuộc một danh mục."));
        }

        material.CategoryId = Normalize(request.CategoryId);
        material.GradeBand = CleanBand(request.GradeBand);
        material.Title = request.Title.Trim();
        material.Type = request.Type;
        material.Source = request.Source;
        material.Url = request.Source == MaterialSource.ExternalUrl ? request.Url?.Trim() : null;
        material.StoredFileId = request.Source == MaterialSource.ServerFile ? request.StoredFileId : null;
        material.Description = request.Description?.Trim();

        materials.Update(material);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(material, await CategoryNameAsync(material.CategoryId, ct));
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

        materials.SoftDelete(material);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
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

    private async Task<string?> CategoryNameAsync(Guid? categoryId, CancellationToken ct) =>
        categoryId is null ? null : (await categories.GetByIdAsync(categoryId.Value, ct: ct))?.Name;

    private static string? Lookup(Dictionary<Guid, string> map, Guid? id) =>
        id.HasValue && map.TryGetValue(id.Value, out var name) ? name : null;

    private static MaterialDto ToDto(LearningMaterial m, string? categoryName)
    {
        var downloadUrl = m.Source == MaterialSource.ServerFile && m.StoredFileId is not null
            ? $"/api/files/{m.StoredFileId}"
            : m.Url ?? string.Empty;
        return new MaterialDto(m.Id, m.ClassId, m.CategoryId, categoryName, m.GradeBand, m.Title, m.Type, m.Source,
            m.Url, m.StoredFileId, m.Description, downloadUrl, m.CreatedAt);
    }
}
