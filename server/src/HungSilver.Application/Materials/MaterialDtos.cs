using HungSilver.Domain.Enums;

namespace HungSilver.Application.Materials;

public sealed record MaterialDto(
    Guid Id,
    Guid? ClassId,
    Guid? CategoryId,
    string? CategoryName,
    string? GradeBand,
    string Title,
    MaterialType Type,
    MaterialSource Source,
    string? Url,
    Guid? StoredFileId,
    string? Description,
    string DownloadUrl,
    DateTime CreatedAt);

public sealed record CreateMaterialRequest(
    Guid? ClassId,
    Guid? CategoryId,
    string? GradeBand,
    string Title,
    MaterialType Type,
    MaterialSource Source,
    string? Url,
    Guid? StoredFileId,
    string? Description);

public sealed record UpdateMaterialRequest(
    Guid? CategoryId,
    string? GradeBand,
    string Title,
    MaterialType Type,
    MaterialSource Source,
    string? Url,
    Guid? StoredFileId,
    string? Description);

// ----------------- Danh mục học liệu (thư viện) -----------------

public sealed record MaterialCategoryDto(Guid Id, string Name, string? Description, int SortOrder);

public sealed record CreateMaterialCategoryRequest(string Name, string? Description, int SortOrder);

public sealed record UpdateMaterialCategoryRequest(string Name, string? Description, int SortOrder);
