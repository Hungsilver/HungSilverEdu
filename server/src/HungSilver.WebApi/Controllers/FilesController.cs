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
public class FilesController(
    IFileService fileService,
    ICurrentUser currentUser,
    IDocumentToPdfConverter documentConverter) : ControllerBase
{
    // Headroom trên MaxSizeBytes (20MB): 20–25MB rơi vào lỗi app tiếng Việt, >25MB bị Kestrel chặn 413.
    private const long MaxUploadBytes = 25L * 1024 * 1024;
    private static readonly HashSet<string> PreviewConvertibleExts =
        new(StringComparer.OrdinalIgnoreCase) { ".doc", ".docx", ".odt", ".rtf", ".txt" };

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
        var access = await EnsureCanAccessAsync(id, ct);
        if (access.IsFailure)
            return access.Error.ToProblemResult();
        var meta = access.Value;

        // ETag theo nội dung (SHA-256) + cache dài vì file bất biến.
        var etag = SetCommonFileHeaders(meta);

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

    /// <summary>
    /// Xem trước file trong trình duyệt. PDF trả inline; Word/ODT/RTF/TXT chuyển sang PDF để đọc trực tiếp.
    /// File không hỗ trợ preview sẽ trả lỗi nghiệp vụ, không ép trình duyệt tải xuống.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("{id:guid}/preview")]
    public async Task<IActionResult> Preview(Guid id, CancellationToken ct)
    {
        var access = await EnsureCanAccessAsync(id, ct);
        if (access.IsFailure)
            return access.Error.ToProblemResult();
        var meta = access.Value;

        var ext = Path.GetExtension(meta.FileName);
        if (!ext.Equals(".pdf", StringComparison.OrdinalIgnoreCase) && !PreviewConvertibleExts.Contains(ext))
            return Error.Validation(
                "Files.PreviewUnsupported",
                "File này chưa hỗ trợ xem trực tiếp. Vui lòng dùng nút Download để tải về.").ToProblemResult();

        SetCommonFileHeaders(meta);

        var download = await fileService.GetForDownloadAsync(id, ct);
        if (download.IsFailure)
            return download.Error.ToProblemResult();
        var f = download.Value;

        Response.Headers.ContentDisposition = new ContentDispositionHeaderValue("inline")
        {
            FileNameStar = PreviewFileName(meta.FileName)
        }.ToString();

        if (ext.Equals(".pdf", StringComparison.OrdinalIgnoreCase))
            return File(f.Content, "application/pdf", enableRangeProcessing: true);

        await using (f.Content)
        {
            var pdf = await documentConverter.ToPdfAsync(f.Content, f.FileName, ct);
            if (pdf.IsFailure)
                return pdf.Error.ToProblemResult();

            return File(pdf.Value, "application/pdf", enableRangeProcessing: true);
        }
    }

    private async Task<Result<StoredFileInfo>> EnsureCanAccessAsync(Guid id, CancellationToken ct)
    {
        var info = await fileService.GetInfoAsync(id, ct);
        if (info.IsFailure)
            return Result.Failure<StoredFileInfo>(info.Error);
        var meta = info.Value;

        if (meta.Visibility == FileVisibility.Public)
            return meta;

        if (!currentUser.IsAuthenticated)
            return Result.Failure<StoredFileInfo>(Error.Unauthorized("Files.Unauthorized", "Cần đăng nhập để tải file này."));

        if (meta.Visibility == FileVisibility.Restricted &&
            meta.UploadedByUserId != currentUser.UserId &&
            !currentUser.IsInRole(AppRoles.Admin) && !currentUser.IsInRole(AppRoles.Teacher))
            return Result.Failure<StoredFileInfo>(Error.Forbidden("Files.Forbidden", "Bạn không có quyền tải file này."));

        return meta;
    }

    private string SetCommonFileHeaders(StoredFileInfo meta)
    {
        var tag = string.IsNullOrEmpty(meta.Sha256) ? meta.Id.ToString("N") : meta.Sha256;
        var etag = $"\"{tag}\"";
        Response.Headers.ETag = etag;
        Response.Headers.CacheControl = meta.Visibility == FileVisibility.Public
            ? "public, max-age=604800, immutable"
            : "private, max-age=604800";
        Response.Headers[HeaderNames.XContentTypeOptions] = "nosniff";
        return etag;
    }

    private static string PreviewFileName(string fileName)
    {
        var name = Path.GetFileNameWithoutExtension(fileName);
        return string.IsNullOrWhiteSpace(name) ? "preview.pdf" : $"{name}.pdf";
    }
}
