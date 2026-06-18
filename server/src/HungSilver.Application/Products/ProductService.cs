using System.Linq.Expressions;
using FluentValidation;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Application.Common.Models;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;

namespace HungSilver.Application.Products;

public interface IProductService
{
    Task<Result<PagedResult<ProductDto>>> GetPagedAsync(PagedRequest request, bool includeDeleted = false, CancellationToken ct = default);
    Task<Result<ProductDto>> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Result<ProductDto>> CreateAsync(CreateProductRequest request, CancellationToken ct = default);
    Task<Result<ProductDto>> UpdateAsync(Guid id, UpdateProductRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<Result> RestoreAsync(Guid id, CancellationToken ct = default);
}

public sealed class ProductService(
    IRepository<Product> products,
    IUnitOfWork unitOfWork,
    IValidator<CreateProductRequest> createValidator,
    IValidator<UpdateProductRequest> updateValidator) : IProductService
{
    private static readonly Error NotFoundError = Error.NotFound("Product.NotFound", "Không tìm thấy sản phẩm.");

    public async Task<Result<PagedResult<ProductDto>>> GetPagedAsync(PagedRequest request, bool includeDeleted = false, CancellationToken ct = default)
    {
        Expression<Func<Product, bool>>? filter = null;
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLower();
            filter = p => p.Name.ToLower().Contains(term) || p.Sku.ToLower().Contains(term);
        }

        var page = await products.GetPagedAsync(
            request.Page, request.PageSize, filter,
            request.SortBy ?? nameof(Product.CreatedAt), request.SortDesc || request.SortBy is null,
            includeDeleted, ct);

        return page.Map(ToDto);
    }

    public async Task<Result<ProductDto>> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var product = await products.GetByIdAsync(id, ct: ct);
        return product is null ? Result.Failure<ProductDto>(NotFoundError) : ToDto(product);
    }

    public async Task<Result<ProductDto>> CreateAsync(CreateProductRequest request, CancellationToken ct = default)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<ProductDto>(validation.ToError("Product.Validation"));

        if (await products.AnyAsync(p => p.Sku == request.Sku, ct))
            return Result.Failure<ProductDto>(Error.Conflict("Product.SkuExists", $"SKU '{request.Sku}' đã tồn tại."));

        var product = new Product
        {
            Name = request.Name.Trim(),
            Sku = request.Sku.Trim(),
            Description = request.Description?.Trim(),
            Price = request.Price,
            IsActive = request.IsActive
        };

        await products.AddAsync(product, ct);
        await unitOfWork.SaveChangesAsync(ct);

        return ToDto(product);
    }

    public async Task<Result<ProductDto>> UpdateAsync(Guid id, UpdateProductRequest request, CancellationToken ct = default)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<ProductDto>(validation.ToError("Product.Validation"));

        var product = await products.GetByIdAsync(id, ct: ct);
        if (product is null)
            return Result.Failure<ProductDto>(NotFoundError);

        if (await products.AnyAsync(p => p.Sku == request.Sku && p.Id != id, ct))
            return Result.Failure<ProductDto>(Error.Conflict("Product.SkuExists", $"SKU '{request.Sku}' đã tồn tại."));

        product.Name = request.Name.Trim();
        product.Sku = request.Sku.Trim();
        product.Description = request.Description?.Trim();
        product.Price = request.Price;
        product.IsActive = request.IsActive;

        products.Update(product);
        await unitOfWork.SaveChangesAsync(ct);

        return ToDto(product);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var product = await products.GetByIdAsync(id, ct: ct);
        if (product is null)
            return Result.Failure(NotFoundError);

        products.SoftDelete(product);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success();
    }

    public async Task<Result> RestoreAsync(Guid id, CancellationToken ct = default)
    {
        var restored = await products.RestoreAsync(id, ct);
        if (!restored)
            return Result.Failure(NotFoundError);

        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }

    private static ProductDto ToDto(Product p) =>
        new(p.Id, p.Name, p.Sku, p.Description, p.Price, p.IsActive, p.IsDeleted, p.CreatedAt, p.UpdatedAt);
}
