using HungSilver.Domain.Enums;

namespace HungSilver.Application.Materials;

public sealed record MaterialDto(
    Guid Id,
    Guid ClassId,
    string Title,
    MaterialType Type,
    MaterialSource Source,
    string? Url,
    Guid? StoredFileId,
    string? Description,
    string DownloadUrl,
    DateTime CreatedAtUtc);

public sealed record CreateMaterialRequest(
    Guid ClassId,
    string Title,
    MaterialType Type,
    MaterialSource Source,
    string? Url,
    Guid? StoredFileId,
    string? Description);

public sealed record UpdateMaterialRequest(
    string Title,
    MaterialType Type,
    MaterialSource Source,
    string? Url,
    Guid? StoredFileId,
    string? Description);
