using HungSilver.Application.Abstractions;
using HungSilver.Application.Files;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Net.Http.Headers;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/files")]
[Authorize]
public class FilesController(IFileService fileService, ICurrentUser currentUser) : ControllerBase
{
    // Headroom trên MaxSizeBytes (20MB): 20–25MB rơi vào lỗi app tiếng Việt, >25MB bị Kestrel chặn 413.
    private const long MaxUploadBytes = 25L * 1024 * 1024;

    /// <summary>Upload file (mọi user đã đăng nhập; chỉ khi FileStorage.Mode = Server). Mặc định Visibility = Authenticated.</summary>
    [HttpPost]
    [RequestSizeLimit(MaxUploadBytes)]
    [EnableRateLimiting("upload")]
    public async Task<ActionResult<StoredFileDto>> Upload(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new ProblemDetails { Title = "Files.Empty", Detail = "Chưa chọn file." });

        await using var stream = file.OpenReadStream();
        var result = await fileService.UploadAsync(stream, file.FileName, file.ContentType, file.Length, ct: ct);
        return result.ToActionResult();
    }

    /// <summary>
    /// Tải/hiển thị file theo id — phân tầng theo Visibility:
    /// Public = ẩn danh (thẻ &lt;img&gt;); Authenticated = phải đăng nhập; Restricted = người upload hoặc Teacher/Admin.
    /// Kèm ETag + Cache-Control + nosniff; trả 304 khi If-None-Match khớp.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var info = await fileService.GetInfoAsync(id, ct);
        if (info.IsFailure)
            return info.Error.ToProblemResult();
        var meta = info.Value;

        if (meta.Visibility != FileVisibility.Public)
        {
            if (!currentUser.IsAuthenticated)
                return Error.Unauthorized("Files.Unauthorized", "Cần đăng nhập để tải file này.").ToProblemResult();

            if (meta.Visibility == FileVisibility.Restricted &&
                meta.UploadedByUserId != currentUser.UserId &&
                !currentUser.IsInRole(AppRoles.Admin) && !currentUser.IsInRole(AppRoles.Teacher))
                return Error.Forbidden("Files.Forbidden", "Bạn không có quyền tải file này.").ToProblemResult();
        }

        // ETag theo nội dung (SHA-256) + cache dài vì file bất biến.
        var tag = string.IsNullOrEmpty(meta.Sha256) ? meta.Id.ToString("N") : meta.Sha256;
        var etag = $"\"{tag}\"";
        Response.Headers.ETag = etag;
        Response.Headers.CacheControl = meta.Visibility == FileVisibility.Public
            ? "public, max-age=604800, immutable"
            : "private, max-age=604800";
        Response.Headers[HeaderNames.XContentTypeOptions] = "nosniff";

        // 304: client đã có bản đúng ⇒ khỏi mở stream. EmptyResult không bị ApiResponseWrapperFilter bọc.
        if (Request.Headers.IfNoneMatch.ToString().Contains(etag, StringComparison.Ordinal))
        {
            Response.StatusCode = StatusCodes.Status304NotModified;
            return new EmptyResult();
        }

        var download = await fileService.GetForDownloadAsync(id, ct);
        if (download.IsFailure)
            return download.Error.ToProblemResult();

        var f = download.Value;
        return File(f.Content, f.ContentType, f.FileName); // có fileName ⇒ Content-Disposition: attachment
    }
}
