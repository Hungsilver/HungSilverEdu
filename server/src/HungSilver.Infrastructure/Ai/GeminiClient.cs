using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using HungSilver.Application.AiCredentials;
using HungSilver.Domain.Common.Results;
using Microsoft.Extensions.Logging;

namespace HungSilver.Infrastructure.Ai;

/// <summary>
/// Typed HttpClient gọi Google Generative Language API (v1beta). Key gửi qua header <c>x-goog-api-key</c>
/// (không nằm trên URL để khỏi lọt vào log). <see cref="GenerateContentAsync"/> ép JSON theo schema, đính kèm
/// tài liệu (PDF vision), đọc body lỗi Google để phân loại (<see cref="GeminiErrorParser"/>) và log đầy đủ.
/// Retry: 5xx/lỗi mạng backoff ngắn; 429 chờ theo Retry-After/RetryInfo (ngân sách 60s); timeout 300s/lượt
/// (typed client để Timeout = Infinite, mỗi method tự đặt CTS riêng — validate 20s, generate 300s),
/// timeout chỉ thử lại 1 lần vì tác vụ chạy dài retry thêm cũng vô ích.
/// </summary>
public sealed class GeminiClient(HttpClient http, ILogger<GeminiClient> logger) : IGeminiClient
{
    private static readonly JsonSerializerOptions SerializeOpts =
        new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    private static readonly TimeSpan GenerateTimeout = TimeSpan.FromSeconds(300);
    private static readonly TimeSpan RateLimitBudget = TimeSpan.FromSeconds(60);

    public async Task<Result> ValidateKeyAsync(string apiKey, string? model = null, CancellationToken ct = default)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(20));

            // Có model ⇒ GET models/{model}: 1 lệnh xác thực cả key lẫn model; không ⇒ ListModels chỉ check key.
            var url = string.IsNullOrWhiteSpace(model)
                ? "v1beta/models"
                : $"v1beta/models/{Uri.EscapeDataString(model)}";
            using var request = NewRequest(HttpMethod.Get, url, apiKey);
            using var response = await http.SendAsync(request, cts.Token);
            if (response.IsSuccessStatusCode)
                return Result.Success();

            var err = GeminiErrorParser.TryParse(await response.Content.ReadAsStringAsync(cts.Token));
            LogHttpError("ValidateKey", response.StatusCode, err, model);
            return Result.Failure(MapError(response.StatusCode, err, model));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or OperationCanceledException)
        {
            logger.LogWarning(ex, "Không gọi được Gemini khi kiểm tra key (model {Model}).", model);
            return Result.Failure(Error.Failure("Ai.ConnectFailed", "Không kết nối được tới Google Gemini. Thử lại sau."));
        }
    }

    public async Task<Result<string>> GenerateContentAsync(GeminiContentRequest request, CancellationToken ct = default)
    {
        var bodyJson = BuildBody(request);
        var url = $"v1beta/models/{Uri.EscapeDataString(request.Model)}:generateContent";

        const int maxAttempts = 3;
        const int maxTimeouts = 2; // tác vụ đã chạy quá 300s thì retry đủ 3 lượt chỉ đốt thêm thời gian + quota
        var rateBudget = RateLimitBudget;
        var timeouts = 0;

        for (var attempt = 1; ; attempt++)
        {
            TimeSpan? delay = null;
            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                cts.CancelAfter(GenerateTimeout);
                using var httpRequest = NewRequest(HttpMethod.Post, url, request.ApiKey);
                httpRequest.Content = new StringContent(bodyJson, Encoding.UTF8, "application/json");
                using var response = await http.SendAsync(httpRequest, cts.Token);
                var raw = await response.Content.ReadAsStringAsync(cts.Token);

                if (response.IsSuccessStatusCode)
                    return HandleSuccess(raw, request.Model);

                var err = GeminiErrorParser.TryParse(raw);
                LogHttpError("GenerateContent", response.StatusCode, err, request.Model);
                var mapped = MapError(response.StatusCode, err, request.Model);

                if (!IsTransient(response.StatusCode) || attempt >= maxAttempts)
                    return Result.Failure<string>(mapped);

                if (response.StatusCode == HttpStatusCode.TooManyRequests)
                {
                    // Quota theo phút/ngày — chờ theo Retry-After/RetryInfo (fallback 15s), trong ngân sách 60s.
                    var wait = RetryAfter(response) ?? err?.RetryDelay ?? TimeSpan.FromSeconds(15);
                    if (wait < TimeSpan.Zero) wait = TimeSpan.Zero;
                    if (wait > RateLimitBudget) wait = RateLimitBudget;
                    if (wait > rateBudget)
                        return Result.Failure<string>(mapped); // chờ cũng không kịp — fail nhanh
                    rateBudget -= wait;
                    delay = wait;
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw; // caller hủy thật — không nuốt.
            }
            catch (OperationCanceledException) // CTS tự hủy ⇒ Gemini xử lý quá 300s
            {
                timeouts++;
                logger.LogWarning("Gemini GenerateContent quá {TimeoutSeconds}s (lượt {Attempt}/{Max}, model {Model}).",
                    (int)GenerateTimeout.TotalSeconds, attempt, maxAttempts, request.Model);
                if (timeouts >= maxTimeouts || attempt >= maxAttempts)
                    return Result.Failure<string>(Error.Failure("Ai.Timeout",
                        $"Gemini xử lý quá lâu (hơn {(int)GenerateTimeout.TotalSeconds} giây mỗi lượt). Thử tài liệu ngắn hơn hoặc thử lại sau."));
            }
            catch (HttpRequestException ex)
            {
                logger.LogWarning(ex, "Không gọi được Gemini (lượt {Attempt}/{Max}, model {Model}).",
                    attempt, maxAttempts, request.Model);
                if (attempt >= maxAttempts)
                    return Result.Failure<string>(Error.Failure("Ai.ConnectFailed", "Không kết nối được tới Google Gemini. Thử lại sau."));
            }

            // Backoff + jitter trước lần thử kế (429 đã tính delay riêng ở trên).
            delay ??= TimeSpan.FromMilliseconds(Math.Pow(2, attempt - 1) * 1000);
            await Task.Delay(delay.Value + TimeSpan.FromMilliseconds(Random.Shared.Next(0, 400)), ct);
        }
    }

    private static bool IsTransient(HttpStatusCode code) =>
        code == HttpStatusCode.TooManyRequests || (int)code >= 500;

    private static HttpRequestMessage NewRequest(HttpMethod method, string url, string apiKey)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.TryAddWithoutValidation("x-goog-api-key", apiKey);
        return request;
    }

    private static TimeSpan? RetryAfter(HttpResponseMessage response)
    {
        var header = response.Headers.RetryAfter;
        if (header is null) return null;
        return header.Delta ?? (header.Date is DateTimeOffset date ? date - DateTimeOffset.Now : null);
    }

    /// <summary>Phân loại lỗi HTTP theo docs Gemini (dùng chung validate + generate), kèm trích message gốc Google.</summary>
    private static Error MapError(HttpStatusCode status, GeminiApiError? err, string? model) => status switch
    {
        HttpStatusCode.BadRequest when err?.Reason == "API_KEY_INVALID" =>
            Error.Validation("Ai.InvalidKey", "API Key không hợp lệ (Google từ chối key). Kiểm tra lại API Key trong trang Hồ sơ."),
        HttpStatusCode.BadRequest when err?.Status == "FAILED_PRECONDITION" =>
            Error.Validation("Ai.BillingRequired",
                $"Gemini bậc miễn phí không khả dụng cho khu vực/tài khoản này — cần bật thanh toán (billing) trong Google AI Studio.{Excerpt(err.Message)}"),
        HttpStatusCode.BadRequest =>
            Error.Failure("Ai.BadRequest",
                $"Yêu cầu gửi Gemini không hợp lệ{(err?.Status is { Length: > 0 } s ? $" ({s})" : "")}.{Excerpt(err?.Message)}"),
        HttpStatusCode.Unauthorized =>
            Error.Validation("Ai.InvalidKey", "API Key không hợp lệ hoặc đã hết hạn. Kiểm tra lại trong trang Hồ sơ."),
        HttpStatusCode.Forbidden =>
            Error.Validation("Ai.InvalidKey", $"API Key không có quyền truy cập Gemini API.{Excerpt(err?.Message)}"),
        HttpStatusCode.NotFound =>
            Error.Validation("Ai.ModelNotFound",
                $"Model '{model}' không tồn tại hoặc không hỗ trợ sinh nội dung. Chọn lại model trong trang Hồ sơ."),
        HttpStatusCode.TooManyRequests =>
            Error.Failure("Ai.RateLimited",
                "Gemini đang giới hạn lưu lượng (hết hạn mức phút/ngày của key). Đợi khoảng 1 phút rồi thử lại; nếu lặp lại, kiểm tra hạn mức trong Google AI Studio."),
        HttpStatusCode.InternalServerError =>
            Error.Failure("Ai.Unavailable", "Google Gemini đang gặp sự cố nội bộ. Thử lại sau ít phút."),
        HttpStatusCode.ServiceUnavailable =>
            Error.Failure("Ai.Unavailable", "Google Gemini quá tải hoặc đang bảo trì. Thử lại sau ít phút."),
        HttpStatusCode.GatewayTimeout =>
            Error.Failure("Ai.Unavailable", "Google Gemini xử lý quá lâu (timeout phía Google). Thử tài liệu ngắn hơn hoặc thử lại sau."),
        _ => Error.Failure("Ai.GenerateFailed", $"Gemini lỗi (mã {(int)status}).{Excerpt(err?.Message)}")
    };

    /// <summary>Trích message gốc (tiếng Anh) của Google ≤200 ký tự để user có thể chuyển tiếp khi cần hỗ trợ.</summary>
    private static string Excerpt(string? googleMessage)
    {
        if (string.IsNullOrWhiteSpace(googleMessage)) return "";
        var msg = googleMessage.ReplaceLineEndings(" ").Trim();
        if (msg.Length > 200) msg = msg[..200] + "…";
        return $" Chi tiết từ Google: {msg}";
    }

    private void LogHttpError(string operation, HttpStatusCode status, GeminiApiError? err, string? model) =>
        logger.LogWarning("Gemini {Operation} lỗi HTTP {StatusCode}: status={GoogleStatus}, reason={Reason}, model={Model}, message={Message}",
            operation, (int)status, err?.Status, err?.Reason, model,
            err?.Message is { Length: > 500 } m ? m[..500] : err?.Message);

    /// <summary>
    /// Đọc response 2xx theo docs: prompt bị chặn (<c>promptFeedback.blockReason</c>) hay dừng bất thường
    /// (<c>finishReason</c> MAX_TOKENS/SAFETY/...) trả lỗi rõ ràng thay vì text rỗng; log <c>usageMetadata</c>.
    /// </summary>
    private Result<string> HandleSuccess(string raw, string model)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;

            if (root.TryGetProperty("promptFeedback", out var feedback)
                && feedback.TryGetProperty("blockReason", out var block)
                && block.ValueKind == JsonValueKind.String && block.GetString() is { Length: > 0 } blockReason)
            {
                logger.LogWarning("Gemini chặn prompt: blockReason={BlockReason}, model={Model}.", blockReason, model);
                return Result.Failure<string>(Error.Failure("Ai.Blocked",
                    $"Gemini từ chối xử lý nội dung (blockReason={blockReason}). Tài liệu có thể chứa nội dung bị chặn — thử tài liệu khác."));
            }

            if (!root.TryGetProperty("candidates", out var candidates)
                || candidates.ValueKind != JsonValueKind.Array || candidates.GetArrayLength() == 0)
                return EmptyResponse();

            var first = candidates[0];
            var finishReason = first.TryGetProperty("finishReason", out var fr) && fr.ValueKind == JsonValueKind.String
                ? fr.GetString()
                : null;
            LogUsage(root, finishReason, model);

            // JSON ép schema bị cắt giữa chừng là vô dụng — báo rõ thay vì để parse hỏng rồi repair-retry tốn thêm lượt.
            if (finishReason == "MAX_TOKENS")
                return Result.Failure<string>(Error.Failure("Ai.Truncated",
                    "Kết quả vượt giới hạn token của model (MAX_TOKENS) nên bị cắt dở. Giảm số câu hỏi hoặc dùng tài liệu ngắn hơn rồi thử lại."));
            if (finishReason is "SAFETY" or "RECITATION" or "BLOCKLIST" or "PROHIBITED_CONTENT" or "SPII")
                return Result.Failure<string>(Error.Failure("Ai.Blocked",
                    $"Gemini dừng tạo nội dung (finishReason={finishReason}). Thử tài liệu khác hoặc chỉnh lại yêu cầu."));

            if (!first.TryGetProperty("content", out var content)
                || !content.TryGetProperty("parts", out var parts) || parts.ValueKind != JsonValueKind.Array)
                return EmptyResponse();

            var sb = new StringBuilder();
            foreach (var part in parts.EnumerateArray())
                if (part.TryGetProperty("text", out var text) && text.ValueKind == JsonValueKind.String)
                    sb.Append(text.GetString());
            return sb.Length == 0 ? EmptyResponse() : Result.Success(sb.ToString());
        }
        catch (JsonException)
        {
            return EmptyResponse();
        }
    }

    private static Result<string> EmptyResponse() =>
        Result.Failure<string>(Error.Failure("Ai.EmptyResponse", "Gemini không trả về nội dung (có thể bị chặn an toàn)."));

    private void LogUsage(JsonElement root, string? finishReason, string model)
    {
        if (!root.TryGetProperty("usageMetadata", out var usage) || usage.ValueKind != JsonValueKind.Object) return;
        int Count(string name) =>
            usage.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt32() : 0;
        logger.LogInformation(
            "Gemini {Model} trả lời: finishReason={FinishReason}, promptTokens={PromptTokens}, thoughtsTokens={ThoughtsTokens}, outputTokens={OutputTokens}, totalTokens={TotalTokens}.",
            model, finishReason, Count("promptTokenCount"), Count("thoughtsTokenCount"),
            Count("candidatesTokenCount"), Count("totalTokenCount"));
    }

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
        if (req.ThinkingBudget is int budget) generationConfig["thinkingConfig"] = new { thinkingBudget = budget };
        else if (!string.IsNullOrWhiteSpace(req.ThinkingLevel)) generationConfig["thinkingConfig"] = new { thinkingLevel = req.ThinkingLevel };
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
}
