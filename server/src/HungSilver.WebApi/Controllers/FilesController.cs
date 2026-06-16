using HungSilver.Application.Files;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/files")]
[Authorize(Policy = "TeacherOrAdmin")]
public class FilesController(IFileService fileService) : ControllerBase
{
    /// <summary>Upload file (chỉ khi cấu hình FileStorage.Mode = Server, do Admin đặt).</summary>
    [HttpPost]
    [RequestSizeLimit(50 * 1024 * 1024)]
    public async Task<ActionResult<StoredFileDto>> Upload(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new ProblemDetails { Title = "Files.Empty", Detail = "Chưa chọn file." });

        await using var stream = file.OpenReadStream();
        var result = await fileService.UploadAsync(stream, file.FileName, file.ContentType, file.Length, ct: ct);
        return result.ToActionResult();
    }

    /// <summary>
    /// Tải/hiển thị file theo id. Cho phép ẩn danh để thẻ &lt;img&gt;/nz-avatar tải được ảnh đại diện
    /// (access token nằm trong bộ nhớ, không gắn được vào thẻ img). Id là GUID không đoán được;
    /// upload vẫn yêu cầu quyền Teacher/Admin.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var result = await fileService.GetForDownloadAsync(id, ct);
        if (result.IsFailure)
            return result.Error.ToProblemResult();

        var file = result.Value;
        return File(file.Content, file.ContentType, file.FileName);
    }
}
