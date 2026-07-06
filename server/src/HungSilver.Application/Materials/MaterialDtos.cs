using HungSilver.Domain.Enums;

namespace HungSilver.Application.Materials;

public sealed record MaterialDto(
    Guid Id,
    string Code,
    Guid? ClassId,
    Guid? CategoryId,
    string? CategoryName,
    Guid? SubjectId,
    string? SubjectName,
    string? GradeBand,
    string Title,
    MaterialSource Source,
    string? Url,
    Guid? StoredFileId,
    string? FileName,
    Guid? CoverFileId,
    string? Description,
    string DownloadUrl,
    DateTime CreatedAt);

public sealed record CreateMaterialRequest(
    Guid? CategoryId,
    Guid? SubjectId,
    string? GradeBand,
    string Title,
    MaterialSource Source,
    string? Url,
    Guid? StoredFileId,
    string? Description,
    Guid? CoverFileId);

public sealed record UpdateMaterialRequest(
    Guid? CategoryId,
    Guid? SubjectId,
    string? GradeBand,
    string Title,
    MaterialSource Source,
    string? Url,
    Guid? StoredFileId,
    string? Description,
    Guid? CoverFileId);

// ----------------- Danh mục học liệu (thư viện) -----------------

public sealed record MaterialCategoryDto(Guid Id, string Name, string? Description, int SortOrder);

public sealed record CreateMaterialCategoryRequest(string Name, string? Description, int SortOrder);

public sealed record UpdateMaterialCategoryRequest(string Name, string? Description, int SortOrder);
