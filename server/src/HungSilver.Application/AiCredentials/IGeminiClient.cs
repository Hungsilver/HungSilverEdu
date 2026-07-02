using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.AiCredentials;

/// <summary>
/// Cổng gọi Google Gemini (Generative Language API). Xác thực key + sinh nội dung có cấu trúc
/// (tạo đề từ tài liệu). Các tính năng AI khác (tóm tắt/báo cáo/chatbot) tái dùng <see cref="GenerateContentAsync"/>.
/// </summary>
public interface IGeminiClient
{
    /// <summary>
    /// Gọi nhẹ tới Gemini để xác thực API key; truyền <paramref name="model"/> để kiểm tra luôn model
    /// còn tồn tại (1 lệnh <c>GET models/{model}</c>). Trả <see cref="Result.Success"/> nếu dùng được.
    /// </summary>
    Task<Result> ValidateKeyAsync(string apiKey, string? model = null, CancellationToken ct = default);

    /// <summary>
    /// Sinh nội dung có cấu trúc — ép JSON theo <c>responseSchema</c>, đính kèm tài liệu (PDF vision) nếu có.
    /// Trả về raw JSON text (caller tự parse). Lỗi HTTP/mạng/timeout → <see cref="Result"/> (không ném); có retry backoff.
    /// </summary>
    Task<Result<string>> GenerateContentAsync(GeminiContentRequest request, CancellationToken ct = default);
}

/// <summary>Tham số gọi Gemini <c>generateContent</c>.</summary>
public sealed record GeminiContentRequest(
    string ApiKey,
    string Model,
    string? SystemInstruction,
    string Prompt,
    IReadOnlyList<GeminiInlineDoc>? Docs = null,
    string? ResponseSchemaJson = null,
    double Temperature = 0.1,
    int? MaxOutputTokens = null);

/// <summary>Tài liệu đính kèm gửi cho Gemini (vd PDF để đọc bằng vision).</summary>
public sealed record GeminiInlineDoc(string MimeType, byte[] Data);
