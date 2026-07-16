using HungSilver.Application.Common.Models;
using HungSilver.Application.Files;
using HungSilver.Application.Materials;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/materials")]
[Authorize(Policy = "TeacherOrAdmin")]
public class MaterialsController(
    IMaterialService materialService,
    IFileService fileService,
    IMaterialAssignmentService assignmentService) : ControllerBase
{
    private const long MaxCoverBytes = 10L * 1024 * 1024; // giống avatar (ProfileController)
    private static readonly string[] CoverImageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

    /// <summary>Danh sách tài liệu (phân trang) — lọc môn/loại/khối/bộ (folderId) hoặc chỉ tài liệu chung (generalOnly) + search Mã/Tên.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<MaterialDto>>> GetPaged(
        [FromQuery] MaterialListFilter filter, [FromQuery] PagedRequest paging, CancellationToken ct) =>
        (await materialService.GetPagedAsync(filter, paging, ct)).ToActionResult();

    [HttpPost]
    public async Task<ActionResult<MaterialDto>> Create(CreateMaterialRequest request, CancellationToken ct) =>
        (await materialService.CreateAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<MaterialDto>> Update(Guid id, UpdateMaterialRequest request, CancellationToken ct) =>
        (await materialService.UpdateAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await materialService.DeleteAsync(id, ct)).ToActionResult();

    // ---- Giao tài liệu cho lớp (mirror giao đề ở ExamsController) ----

    /// <summary>Giao tài liệu cho lớp (tùy chọn gắn buổi học) — học viên xem ở Portal.</summary>
    [HttpPost("{id:guid}/assign")]
    public async Task<ActionResult<MaterialAssignmentDto>> Assign(Guid id, AssignMaterialRequest request, CancellationToken ct) =>
        (await assignmentService.AssignAsync(id, request, ct)).ToActionResult();

    [HttpGet("assignments/by-class/{classId:guid}")]
    public async Task<ActionResult<List<MaterialAssignmentDto>>> AssignmentsByClass(Guid classId, CancellationToken ct) =>
        (await assignmentService.ListByClassAsync(classId, ct)).ToActionResult();

    [HttpGet("assignments/by-session/{sessionId:guid}")]
    public async Task<ActionResult<List<MaterialAssignmentDto>>> AssignmentsBySession(Guid sessionId, CancellationToken ct) =>
        (await assignmentService.ListBySessionAsync(sessionId, ct)).ToActionResult();

    /// <summary>Thu hồi lượt giao (xóa mềm) — tài liệu biến mất khỏi Portal của lớp.</summary>
    [HttpDelete("assignments/{id:guid}")]
    public async Task<ActionResult> RemoveAssignment(Guid id, CancellationToken ct) =>
        (await assignmentService.RemoveAsync(id, ct)).ToActionResult();

    /// <summary>Trạng thái đã xem per-student của một lượt giao.</summary>
    [HttpGet("assignments/{id:guid}/viewers")]
    public async Task<ActionResult<List<MaterialAssignmentViewerDto>>> AssignmentViewers(Guid id, CancellationToken ct) =>
        (await assignmentService.GetViewersAsync(id, ct)).ToActionResult();

    /// <summary>
    /// Upload ảnh bìa tài liệu (chỉ ảnh; lưu server bất kể FileStorage.Mode — mirror avatar;
    /// Visibility = Public để hiển thị trực tiếp qua &lt;img&gt; + cache immutable).
    /// </summary>
    [HttpPost("cover-image")]
    [RequestSizeLimit(MaxCoverBytes)]
    [EnableRateLimiting("upload")]
    public async Task<ActionResult<StoredFileDto>> UploadCover(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return Error.Validation("Files.Empty", "Chưa chọn ảnh.").ToProblemResult();

        var ext = Path.GetExtension(file.FileName ?? string.Empty).ToLowerInvariant();
        if (!CoverImageExtensions.Contains(ext)
            || !(file.ContentType?.StartsWith("image/", StringComparison.OrdinalIgnoreCase) ?? false))
            return Error.Validation("Files.NotImage", "Ảnh bìa chỉ chấp nhận jpg, jpeg, png, gif, webp.").ToProblemResult();

        await using var stream = file.OpenReadStream();
        var result = await fileService.UploadAsync(stream, file.FileName!, file.ContentType!, file.Length,
            enforceStorageMode: false, visibility: FileVisibility.Public, ct: ct);
        return result.ToActionResult();
    }
}
