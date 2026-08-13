using HungSilver.Domain.Enums;

namespace HungSilver.Application.Materials;

/// <summary><paramref name="ExamCount"/> = số đề đã sinh từ tài liệu này (badge "N đề" ở Kho tài liệu).</summary>
public sealed record MaterialDto(
    Guid Id,
    string Code,
    Guid? FolderId,
    Guid? UnitId,
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
    int ExamCount,
    DateTime CreatedAt);

/// <summary>Có FolderId ⇒ tài liệu thuộc bộ: Môn/Khối snapshot TỪ BỘ (bỏ qua giá trị client gửi).
/// UnitId chỉ có nghĩa khi có FolderId và unit phải thuộc đúng bộ đó.</summary>
public sealed record CreateMaterialRequest(
    Guid? SubjectId,
    string? GradeBand,
    string Title,
    MaterialSource Source,
    string? Url,
    Guid? StoredFileId,
    string? Description,
    Guid? CoverFileId,
    Guid? FolderId = null,
    Guid? UnitId = null);

public sealed record UpdateMaterialRequest(
    Guid? SubjectId,
    string? GradeBand,
    string Title,
    MaterialSource Source,
    string? Url,
    Guid? StoredFileId,
    string? Description,
    Guid? CoverFileId,
    Guid? FolderId = null,
    Guid? UnitId = null);

/// <summary>Bộ lọc danh sách tài liệu — FolderId ưu tiên; GeneralOnly=true chỉ lấy tài liệu chung (FolderId null);
/// UnitId lọc theo unit trong bộ; NoUnit=true chỉ lấy tài liệu chưa thuộc unit (bỏ qua khi UnitId cụ thể).</summary>
public sealed class MaterialListFilter
{
    public Guid? SubjectId { get; set; }
    public string? GradeBand { get; set; }
    public Guid? FolderId { get; set; }
    public bool GeneralOnly { get; set; }
    public Guid? UnitId { get; set; }
    public bool NoUnit { get; set; }
}

// ----------------- Bộ tài liệu (MaterialFolder) -----------------

public sealed record MaterialFolderDto(
    Guid Id, Guid SubjectId, string SubjectName, string Name, string? GradeBand,
    Guid? CoverFileId, string? Description, int MaterialCount, int UnitCount, int ExamCount, DateTime CreatedAt);

public sealed record CreateMaterialFolderRequest(
    Guid SubjectId, string Name, string? GradeBand, Guid? CoverFileId, string? Description);

/// <summary>Không có SubjectId — Môn của bộ bất biến sau khi tạo (muốn đổi môn thì tạo bộ mới).</summary>
public sealed record UpdateMaterialFolderRequest(
    string Name, string? GradeBand, Guid? CoverFileId, string? Description);

/// <summary>Mức 1 "Tài liệu môn học": mỗi môn kèm số bộ + số tài liệu trong các bộ.</summary>
public sealed record MaterialSubjectSummaryDto(Guid SubjectId, string SubjectName, int FolderCount, int MaterialCount, int ExamCount);

// ----------------- Unit/Chương trong bộ (MaterialUnit) -----------------

/// <summary>UnitNo derive server-side theo vị trí SortOrder, đếm riêng từng Kind
/// (Unit đếm 1,2,3…; Review đếm 1,2… độc lập) — không lưu DB nên reorder/xóa không bao giờ lệch số.
/// <paramref name="ExamCount"/> = tổng đề sinh từ các tài liệu trong unit (hiện ở mục lục).</summary>
public sealed record MaterialUnitDto(
    Guid Id, Guid FolderId, MaterialUnitKind Kind, string Name,
    int UnitNo, int SortOrder, int MaterialCount, int ExamCount, DateTime CreatedAt);

public sealed record CreateMaterialUnitRequest(Guid FolderId, MaterialUnitKind Kind, string? Name);

/// <summary>Không có FolderId — unit thuộc bộ bất biến. Không có SortOrder — sắp xếp qua endpoint reorder.</summary>
public sealed record UpdateMaterialUnitRequest(MaterialUnitKind Kind, string? Name);

/// <summary>OrderedIds phải khớp CHÍNH XÁC tập unit đang có của bộ (không thiếu, không thừa, không trùng).</summary>
public sealed record ReorderMaterialUnitsRequest(Guid FolderId, List<Guid> OrderedIds);
