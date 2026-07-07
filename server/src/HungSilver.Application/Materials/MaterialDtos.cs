using HungSilver.Domain.Enums;

namespace HungSilver.Application.Materials;

public sealed record MaterialDto(
    Guid Id,
    string Code,
    Guid? ClassId,
    Guid? FolderId,
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

/// <summary>Có FolderId ⇒ tài liệu thuộc bộ: Môn/Khối snapshot TỪ BỘ (bỏ qua giá trị client gửi), Loại không bắt buộc.</summary>
public sealed record CreateMaterialRequest(
    Guid? CategoryId,
    Guid? SubjectId,
    string? GradeBand,
    string Title,
    MaterialSource Source,
    string? Url,
    Guid? StoredFileId,
    string? Description,
    Guid? CoverFileId,
    Guid? FolderId = null);

public sealed record UpdateMaterialRequest(
    Guid? CategoryId,
    Guid? SubjectId,
    string? GradeBand,
    string Title,
    MaterialSource Source,
    string? Url,
    Guid? StoredFileId,
    string? Description,
    Guid? CoverFileId,
    Guid? FolderId = null);

/// <summary>Bộ lọc danh sách tài liệu — FolderId ưu tiên; GeneralOnly=true chỉ lấy tài liệu chung (FolderId null).</summary>
public sealed class MaterialListFilter
{
    public Guid? SubjectId { get; set; }
    public Guid? CategoryId { get; set; }
    public string? GradeBand { get; set; }
    public Guid? FolderId { get; set; }
    public bool GeneralOnly { get; set; }
}

// ----------------- Bộ tài liệu (MaterialFolder) -----------------

public sealed record MaterialFolderDto(
    Guid Id, Guid SubjectId, string SubjectName, string Name, string? GradeBand,
    Guid? CoverFileId, string? Description, int MaterialCount, DateTime CreatedAt);

public sealed record CreateMaterialFolderRequest(
    Guid SubjectId, string Name, string? GradeBand, Guid? CoverFileId, string? Description);

/// <summary>Không có SubjectId — Môn của bộ bất biến sau khi tạo (muốn đổi môn thì tạo bộ mới).</summary>
public sealed record UpdateMaterialFolderRequest(
    string Name, string? GradeBand, Guid? CoverFileId, string? Description);

/// <summary>Mức 1 "Tài liệu môn học": mỗi môn kèm số bộ + số tài liệu trong các bộ.</summary>
public sealed record MaterialSubjectSummaryDto(Guid SubjectId, string SubjectName, int FolderCount, int MaterialCount);

// ----------------- Danh mục học liệu (thư viện) -----------------

public sealed record MaterialCategoryDto(Guid Id, string Name, string? Description, int SortOrder);

public sealed record CreateMaterialCategoryRequest(string Name, string? Description, int SortOrder);

public sealed record UpdateMaterialCategoryRequest(string Name, string? Description, int SortOrder);
