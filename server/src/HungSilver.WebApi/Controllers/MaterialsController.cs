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
public class MaterialsController(IMaterialService materialService, IFileService fileService) : ControllerBase
{
    private const long MaxCoverBytes = 10L * 1024 * 1024; // giống avatar (ProfileController)
    private static readonly string[] CoverImageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

    /// <summary>Danh sách tất cả tài liệu (phân trang) — lọc theo môn/loại/khối + search Mã/Tên.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<MaterialDto>>> GetPaged(
        [FromQuery] Guid? subjectId, [FromQuery] Guid? categoryId, [FromQuery] string? gradeBand,
        [FromQuery] PagedRequest paging, CancellationToken ct) =>
        (await materialService.GetPagedAsync(subjectId, categoryId, gradeBand, paging, ct)).ToActionResult();

    [HttpPost]
    public async Task<ActionResult<MaterialDto>> Create(CreateMaterialRequest request, CancellationToken ct) =>
        (await materialService.CreateAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<MaterialDto>> Update(Guid id, UpdateMaterialRequest request, CancellationToken ct) =>
        (await materialService.UpdateAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await materialService.DeleteAsync(id, ct)).ToActionResult();

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
