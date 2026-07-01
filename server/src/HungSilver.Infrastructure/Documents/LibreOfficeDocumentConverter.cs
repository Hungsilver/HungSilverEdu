using System.Diagnostics;
using HungSilver.Application.Abstractions;
using HungSilver.Domain.Common.Results;
using Microsoft.Extensions.Options;

namespace HungSilver.Infrastructure.Documents;

/// <summary>
/// Chuyển tài liệu sang PDF để Gemini đọc bằng vision (sát nhất). PDF ⇒ passthrough; Word/ODT/RTF/TXT ⇒ gọi
/// LibreOffice headless (<c>soffice --convert-to pdf</c>) với profile riêng từng lần (chạy song song an toàn).
/// </summary>
public sealed class LibreOfficeDocumentConverter(IOptions<DocumentConversionOptions> options) : IDocumentToPdfConverter
{
    private static readonly HashSet<string> ConvertibleExts =
        new(StringComparer.OrdinalIgnoreCase) { ".docx", ".doc", ".odt", ".rtf", ".txt" };

    public async Task<Result<byte[]>> ToPdfAsync(Stream content, string fileName, CancellationToken ct = default)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();

        if (ext == ".pdf")
        {
            using var ms = new MemoryStream();
            await content.CopyToAsync(ms, ct);
            return ms.ToArray();
        }

        if (!ConvertibleExts.Contains(ext))
            return Result.Failure<byte[]>(Error.Validation("Doc.Unsupported", "Chỉ hỗ trợ tài liệu PDF hoặc Word (.docx/.doc)."));

        var opt = options.Value;
        var workDir = Path.Combine(Path.GetTempPath(), "hs_docconv_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(workDir);
        var inPath = Path.Combine(workDir, "input" + ext);

        try
        {
            await using (var fs = File.Create(inPath))
                await content.CopyToAsync(fs, ct);

            var soffice = string.IsNullOrWhiteSpace(opt.SofficePath) ? "soffice" : opt.SofficePath;
            var profileDir = Path.Combine(workDir, "profile");

            var psi = new ProcessStartInfo
            {
                FileName = soffice,
                UseShellExecute = false,
                RedirectStandardError = true,
                RedirectStandardOutput = true,
                CreateNoWindow = true
            };
            psi.ArgumentList.Add($"-env:UserInstallation=file:///{profileDir.Replace('\\', '/')}");
            psi.ArgumentList.Add("--headless");
            psi.ArgumentList.Add("--norestore");
            psi.ArgumentList.Add("--convert-to");
            psi.ArgumentList.Add("pdf");
            psi.ArgumentList.Add("--outdir");
            psi.ArgumentList.Add(workDir);
            psi.ArgumentList.Add(inPath);

            using var proc = Process.Start(psi);
            if (proc is null)
                return Result.Failure<byte[]>(Error.Failure("Doc.ConvertFailed", "Không khởi chạy được LibreOffice (soffice). Kiểm tra đã cài đặt."));

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(opt.TimeoutSeconds));
            try
            {
                await proc.WaitForExitAsync(cts.Token);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                try { proc.Kill(entireProcessTree: true); } catch { /* best-effort */ }
                return Result.Failure<byte[]>(Error.Failure("Doc.ConvertTimeout", "Chuyển tài liệu sang PDF quá thời gian."));
            }

            var outPath = Path.Combine(workDir, "input.pdf");
            if (proc.ExitCode != 0 || !File.Exists(outPath))
                return Result.Failure<byte[]>(Error.Failure("Doc.ConvertFailed", "Không chuyển được tài liệu sang PDF (kiểm tra LibreOffice đã cài)."));

            return await File.ReadAllBytesAsync(outPath, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return Result.Failure<byte[]>(Error.Failure("Doc.ConvertFailed", "Lỗi khi chuyển tài liệu sang PDF (kiểm tra LibreOffice)."));
        }
        finally
        {
            try { Directory.Delete(workDir, recursive: true); } catch { /* best-effort cleanup */ }
        }
    }
}
