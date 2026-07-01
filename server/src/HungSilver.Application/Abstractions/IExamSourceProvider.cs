using HungSilver.Application.AiCredentials;
using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Abstractions;

/// <summary>Đọc file của 1 tài liệu (StoredFile) và chuẩn hóa thành PDF part để gửi Gemini (vision).</summary>
public interface IExamSourceProvider
{
    Task<Result<GeminiInlineDoc>> GetPdfPartAsync(Guid storedFileId, CancellationToken ct = default);
}
