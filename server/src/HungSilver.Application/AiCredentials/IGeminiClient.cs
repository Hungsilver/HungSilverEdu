using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.AiCredentials;

/// <summary>
/// Cổng gọi Google Gemini (Generative Language API). Đợt này chỉ cần kiểm tra tính hợp lệ của key;
/// các tính năng AI tương lai (tạo đề/tóm tắt/báo cáo/chatbot) bổ sung method generate vào đây.
/// </summary>
public interface IGeminiClient
{
    /// <summary>Gọi nhẹ tới Gemini để xác thực API key. Trả <see cref="Result.Success"/> nếu key dùng được.</summary>
    Task<Result> ValidateKeyAsync(string apiKey, CancellationToken ct = default);
}
