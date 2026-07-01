using HungSilver.Application.Abstractions;
using HungSilver.Application.AiCredentials;
using HungSilver.Application.Files;
using HungSilver.Domain.Common.Results;

namespace HungSilver.Infrastructure.Documents;

/// <summary>Đọc file của tài liệu (StoredFile) → chuẩn hóa về PDF → đóng gói thành part gửi Gemini (vision).</summary>
public sealed class ExamSourceProvider(IFileService files, IDocumentToPdfConverter converter) : IExamSourceProvider
{
    public async Task<Result<GeminiInlineDoc>> GetPdfPartAsync(Guid storedFileId, CancellationToken ct = default)
    {
        var download = await files.GetForDownloadAsync(storedFileId, ct);
        if (download.IsFailure)
            return Result.Failure<GeminiInlineDoc>(download.Error);

        await using var stream = download.Value.Content;
        var pdf = await converter.ToPdfAsync(stream, download.Value.FileName, ct);
        if (pdf.IsFailure)
            return Result.Failure<GeminiInlineDoc>(pdf.Error);

        return new GeminiInlineDoc("application/pdf", pdf.Value);
    }
}
