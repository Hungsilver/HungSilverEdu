namespace HungSilver.Application.Products;

public sealed record ProductDto(
    Guid Id,
    string Name,
    string Sku,
    string? Description,
    decimal Price,
    bool IsActive,
    bool IsDeleted,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record CreateProductRequest(string Name, string Sku, string? Description, decimal Price, bool IsActive);

public sealed record UpdateProductRequest(string Name, string Sku, string? Description, decimal Price, bool IsActive);
