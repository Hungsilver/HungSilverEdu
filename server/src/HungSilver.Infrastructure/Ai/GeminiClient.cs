using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using HungSilver.Application.AiCredentials;
using HungSilver.Domain.Common.Results;

namespace HungSilver.Infrastructure.Ai;

/// <summary>
/// Typed HttpClient gọi Google Generative Language API. <see cref="GenerateContentAsync"/> ép JSON theo schema,
/// đính kèm tài liệu (PDF vision), tự retry backoff khi gặp lỗi tạm thời. BaseAddress cấu hình ở DI; mỗi method
/// tự đặt timeout riêng (typed client để Timeout = Infinite) — validate ngắn, generate dài.
/// </summary>
public sealed class GeminiClient(HttpClient http) : IGeminiClient
{
    private static readonly JsonSerializerOptions SerializeOpts =
        new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    public async Task<Result> ValidateKeyAsync(string apiKey, CancellationToken ct = default)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(20));

            // Gọi nhẹ ListModels — 200 ⇒ key dùng được; 400/401/403 ⇒ key sai/không có quyền.
            using var response = await http.GetAsync($"v1beta/models?key={Uri.EscapeDataString(apiKey)}", cts.Token);
            if (response.IsSuccessStatusCode)
                return Result.Success();

            if (response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
                return Result.Failure(Error.Validation("Ai.InvalidKey", "API Key không hợp lệ hoặc không có quyền truy cập Gemini."));

            return Result.Failure(Error.Failure("Ai.ValidateFailed", $"Không kiểm tra được key (mã {(int)response.StatusCode})."));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or OperationCanceledException)
        {
            return Result.Failure(Error.Failure("Ai.ConnectFailed", "Không kết nối được tới Google Gemini. Thử lại sau."));
        }
    }

    public async Task<Result<string>> GenerateContentAsync(GeminiContentRequest request, CancellationToken ct = default)
    {
        var bodyJson = BuildBody(request);
        var url = $"v1beta/models/{request.Model}:generateContent?key={Uri.EscapeDataString(request.ApiKey)}";

        const int maxAttempts = 3;
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                cts.CancelAfter(TimeSpan.FromSeconds(120));
                using var content = new StringContent(bodyJson, Encoding.UTF8, "application/json");
                using var response = await http.PostAsync(url, content, cts.Token);

                if (response.IsSuccessStatusCode)
                {
                    var raw = await response.Content.ReadAsStringAsync(cts.Token);
                    var text = ExtractText(raw);
                    return text is null
                        ? Result.Failure<string>(Error.Failure("Ai.EmptyResponse", "Gemini không trả về nội dung (có thể bị chặn an toàn)."))
                        : Result.Success(text);
                }

                // 400/401/403 ⇒ key/quyền/quota sai — không retry.
                if (response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
                    return Result.Failure<string>(Error.Validation("Ai.InvalidKey", "API Key không hợp lệ hoặc không đủ quyền/quota Gemini."));

                // 429/5xx ⇒ tạm thời, thử lại; hết lượt hoặc lỗi khác ⇒ trả lỗi.
                if (attempt >= maxAttempts || !IsTransient(response.StatusCode))
                    return Result.Failure<string>(Error.Failure("Ai.GenerateFailed", $"Gemini lỗi (mã {(int)response.StatusCode})."));
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw; // caller hủy thật — không nuốt.
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or OperationCanceledException)
            {
                if (attempt >= maxAttempts)
                    return Result.Failure<string>(Error.Failure("Ai.ConnectFailed", "Không kết nối được tới Google Gemini. Thử lại sau."));
            }

            // Backoff + jitter trước lần thử kế.
            var delayMs = (int)(Math.Pow(2, attempt - 1) * 1000) + Random.Shared.Next(0, 400);
            await Task.Delay(delayMs, ct);
        }
    }

    private static bool IsTransient(HttpStatusCode code) =>
        code == HttpStatusCode.TooManyRequests || (int)code >= 500;

    private static string BuildBody(GeminiContentRequest req)
    {
        var parts = new List<object>();
        if (req.Docs is not null)
            foreach (var d in req.Docs)
                parts.Add(new { inlineData = new { mimeType = d.MimeType, data = Convert.ToBase64String(d.Data) } });
        parts.Add(new { text = req.Prompt });

        var generationConfig = new Dictionary<string, object?>
        {
            ["responseMimeType"] = "application/json",
            ["temperature"] = req.Temperature,
            ["candidateCount"] = 1
        };
        if (req.MaxOutputTokens is int max) generationConfig["maxOutputTokens"] = max;
        if (!string.IsNullOrWhiteSpace(req.ResponseSchemaJson))
            generationConfig["responseSchema"] = JsonNode.Parse(req.ResponseSchemaJson);

        var body = new Dictionary<string, object?>
        {
            ["contents"] = new[] { new { role = "user", parts } },
            ["generationConfig"] = generationConfig
        };
        if (!string.IsNullOrWhiteSpace(req.SystemInstruction))
            body["systemInstruction"] = new { parts = new[] { new { text = req.SystemInstruction } } };

        return JsonSerializer.Serialize(body, SerializeOpts);
    }

    /// <summary>Gộp text từ candidates[0].content.parts[*].text; null nếu rỗng/bị chặn/parse lỗi.</summary>
    private static string? ExtractText(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (!doc.RootElement.TryGetProperty("candidates", out var cands) || cands.GetArrayLength() == 0)
                return null;
            var first = cands[0];
            if (!first.TryGetProperty("content", out var c) || !c.TryGetProperty("parts", out var ps))
                return null;
            var sb = new StringBuilder();
            foreach (var p in ps.EnumerateArray())
                if (p.TryGetProperty("text", out var t))
                    sb.Append(t.GetString());
            return sb.Length == 0 ? null : sb.ToString();
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
