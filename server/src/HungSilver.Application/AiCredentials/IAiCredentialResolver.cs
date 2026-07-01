using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.AiCredentials;

/// <summary>
/// Seam cho các tính năng AI (tạo đề/tóm tắt/báo cáo/chatbot): lấy API key đã giải mã của một user
/// để gọi Gemini. Trả NotFound nếu user chưa cấu hình key.
/// </summary>
public interface IAiCredentialResolver
{
    Task<Result<string>> GetApiKeyForUserAsync(Guid userId, CancellationToken ct = default);

    /// <summary>Lấy key đã giải mã + model (<c>cred.Model ?? DefaultModel</c>) để gọi sinh nội dung.</summary>
    Task<Result<ResolvedAiCredential>> ResolveForUserAsync(Guid userId, CancellationToken ct = default);
}

/// <summary>Key + model đã sẵn sàng gọi Gemini.</summary>
public sealed record ResolvedAiCredential(string ApiKey, string Model);
