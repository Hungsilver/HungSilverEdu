using System.Net;
using HungSilver.Application.AiCredentials;
using HungSilver.Domain.Common.Results;

namespace HungSilver.Infrastructure.Ai;

/// <summary>
/// Typed HttpClient gọi Google Generative Language API (typed client đầu tiên của repo).
/// BaseAddress/Timeout cấu hình ở DI (<c>AddHttpClient&lt;IGeminiClient, GeminiClient&gt;</c>).
/// </summary>
public sealed class GeminiClient(HttpClient http) : IGeminiClient
{
    public async Task<Result> ValidateKeyAsync(string apiKey, CancellationToken ct = default)
    {
        try
        {
            // Gọi nhẹ ListModels — 200 ⇒ key dùng được; 400/401/403 ⇒ key sai/không có quyền.
            using var response = await http.GetAsync($"v1beta/models?key={Uri.EscapeDataString(apiKey)}", ct);
            if (response.IsSuccessStatusCode)
                return Result.Success();

            if (response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
                return Result.Failure(Error.Validation("Ai.InvalidKey", "API Key không hợp lệ hoặc không có quyền truy cập Gemini."));

            return Result.Failure(Error.Failure("Ai.ValidateFailed", $"Không kiểm tra được key (mã {(int)response.StatusCode})."));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            // Lỗi mạng/timeout — không ném ra ngoài, giữ luồng nghiệp vụ bằng Result.
            return Result.Failure(Error.Failure("Ai.ConnectFailed", "Không kết nối được tới Google Gemini. Thử lại sau."));
        }
    }
}
