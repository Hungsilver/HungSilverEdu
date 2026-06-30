using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.AiCredentials;

/// <summary>
/// Seam cho các tính năng AI tương lai (tạo đề/tóm tắt/báo cáo/chatbot): lấy API key đã giải mã
/// của một user để gọi Gemini. Trả NotFound nếu user chưa cấu hình key.
/// </summary>
public interface IAiCredentialResolver
{
    Task<Result<string>> GetApiKeyForUserAsync(Guid userId, CancellationToken ct = default);
}
