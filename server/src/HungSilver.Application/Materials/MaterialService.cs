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
    Task<Result<MaterialDto>> CreateAsync(CreateMaterialRequest request, CancellationToken ct = default);
    Task<Result<MaterialDto>> UpdateAsync(Guid id, UpdateMaterialRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
}

public sealed class MaterialService(
    IRepository<LearningMaterial> materials,
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
        return items.OrderByDescending(m => m.CreatedAtUtc).Select(ToDto).ToList();
    }

    public async Task<Result<MaterialDto>> CreateAsync(CreateMaterialRequest request, CancellationToken ct = default)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<MaterialDto>(validation.ToError("Material.Validation"));

        var access = await accessGuard.EnsureCanAccessClassAsync(request.ClassId, ct);
        if (access.IsFailure)
            return Result.Failure<MaterialDto>(access.Error);

        var material = new LearningMaterial
        {
            ClassId = request.ClassId,
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
        return ToDto(material);
    }

    public async Task<Result<MaterialDto>> UpdateAsync(Guid id, UpdateMaterialRequest request, CancellationToken ct = default)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<MaterialDto>(validation.ToError("Material.Validation"));

        var material = await materials.GetByIdAsync(id, ct: ct);
        if (material is null)
            return Result.Failure<MaterialDto>(NotFoundError);

        var access = await accessGuard.EnsureCanAccessClassAsync(material.ClassId, ct);
        if (access.IsFailure)
            return Result.Failure<MaterialDto>(access.Error);

        material.Title = request.Title.Trim();
        material.Type = request.Type;
        material.Source = request.Source;
        material.Url = request.Source == MaterialSource.ExternalUrl ? request.Url?.Trim() : null;
        material.StoredFileId = request.Source == MaterialSource.ServerFile ? request.StoredFileId : null;
        material.Description = request.Description?.Trim();

        materials.Update(material);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(material);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var material = await materials.GetByIdAsync(id, ct: ct);
        if (material is null)
            return Result.Failure(NotFoundError);

        var access = await accessGuard.EnsureCanAccessClassAsync(material.ClassId, ct);
        if (access.IsFailure)
            return access;

        materials.SoftDelete(material);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }

    private static MaterialDto ToDto(LearningMaterial m)
    {
        var downloadUrl = m.Source == MaterialSource.ServerFile && m.StoredFileId is not null
            ? $"/api/files/{m.StoredFileId}"
            : m.Url ?? string.Empty;
        return new MaterialDto(m.Id, m.ClassId, m.Title, m.Type, m.Source, m.Url, m.StoredFileId, m.Description, downloadUrl, m.CreatedAtUtc);
    }
}
