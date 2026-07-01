using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Abstractions;

/// <summary>
/// Chuẩn hóa tài liệu (PDF/Word…) về PDF để cho Gemini đọc bằng vision — sát nhất (giữ gạch chân/ảnh/bố cục).
/// Abstraction để có thể đổi bộ chuyển (LibreOffice/thư viện .NET/cloud) mà không đụng nghiệp vụ.
/// </summary>
public interface IDocumentToPdfConverter
{
    Task<Result<byte[]>> ToPdfAsync(Stream content, string fileName, CancellationToken ct = default);
}
