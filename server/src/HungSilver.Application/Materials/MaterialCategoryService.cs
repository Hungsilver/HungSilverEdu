using HungSilver.Application.Abstractions;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;

namespace HungSilver.Application.Materials;

public interface IMaterialCategoryService
{
    Task<Result<List<MaterialCategoryDto>>> GetAllAsync(CancellationToken ct = default);
    Task<Result<MaterialCategoryDto>> CreateAsync(CreateMaterialCategoryRequest request, CancellationToken ct = default);
    Task<Result<MaterialCategoryDto>> UpdateAsync(Guid id, UpdateMaterialCategoryRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
}

public sealed class MaterialCategoryService(
    IRepository<MaterialCategory> categories,
    IUnitOfWork unitOfWork) : IMaterialCategoryService
{
    private static readonly Error NotFoundError = Error.NotFound("MaterialCategory.NotFound", "Không tìm thấy danh mục.");

    public async Task<Result<List<MaterialCategoryDto>>> GetAllAsync(CancellationToken ct = default)
    {
        var items = await categories.FindAsync(_ => true, ct);
        return items.OrderBy(c => c.SortOrder).ThenBy(c => c.Name).Select(ToDto).ToList();
    }

    public async Task<Result<MaterialCategoryDto>> CreateAsync(CreateMaterialCategoryRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return Result.Failure<MaterialCategoryDto>(Error.Validation("MaterialCategory.NameRequired", "Tên danh mục bắt buộc."));

        var category = new MaterialCategory
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            SortOrder = request.SortOrder
        };
        await categories.AddAsync(category, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(category);
    }

    public async Task<Result<MaterialCategoryDto>> UpdateAsync(Guid id, UpdateMaterialCategoryRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return Result.Failure<MaterialCategoryDto>(Error.Validation("MaterialCategory.NameRequired", "Tên danh mục bắt buộc."));

        var category = await categories.GetByIdAsync(id, ct: ct);
        if (category is null)
            return Result.Failure<MaterialCategoryDto>(NotFoundError);

        category.Name = request.Name.Trim();
        category.Description = request.Description?.Trim();
        category.SortOrder = request.SortOrder;
        categories.Update(category);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(category);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var category = await categories.GetByIdAsync(id, ct: ct);
        if (category is null)
            return Result.Failure(NotFoundError);

        categories.SoftDelete(category);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }

    private static MaterialCategoryDto ToDto(MaterialCategory c) => new(c.Id, c.Name, c.Description, c.SortOrder);
}
