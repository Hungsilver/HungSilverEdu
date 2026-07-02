using System.Net;
using System.Net.Http.Headers;
using System.Text;
using HungSilver.Application.AiCredentials;
using HungSilver.Infrastructure.Ai;
using Microsoft.Extensions.Logging;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>
/// Kiểm chứng GeminiClient map lỗi HTTP theo docs Google (body lỗi → mã Ai.* + message tiếng Việt),
/// retry 429 theo Retry-After, đọc finishReason/blockReason, và gửi key qua header thay vì URL.
/// </summary>
public sealed class GeminiClientTests
{
    private static readonly GeminiContentRequest Request =
        new("test-key", "gemini-2.5-flash", null, "prompt");

    [Fact]
    public async Task GenerateContent_Model404_ReturnsModelNotFoundWithModelName()
    {
        var handler = new StubHttpHandler();
        handler.Enqueue(Json(HttpStatusCode.NotFound,
            """{"error":{"code":404,"message":"models/gemini-2.5-flash is not found for API version v1beta","status":"NOT_FOUND"}}"""));

        var result = await NewClient(handler).GenerateContentAsync(Request);

        Assert.True(result.IsFailure);
        Assert.Equal("Ai.ModelNotFound", result.Error.Code);
        Assert.Contains("gemini-2.5-flash", result.Error.Message);
        Assert.Single(handler.Calls); // 404 không retry
    }

    [Fact]
    public async Task GenerateContent_FailedPrecondition400_ReturnsBillingRequired()
    {
        var handler = new StubHttpHandler();
        handler.Enqueue(Json(HttpStatusCode.BadRequest,
            """{"error":{"code":400,"message":"User location is not supported for the API use without a billing account linked.","status":"FAILED_PRECONDITION"}}"""));

        var result = await NewClient(handler).GenerateContentAsync(Request);

        Assert.True(result.IsFailure);
        Assert.Equal("Ai.BillingRequired", result.Error.Code);
        Assert.Contains("billing", result.Error.Message);
    }

    [Fact]
    public async Task GenerateContent_ApiKeyInvalidReason400_ReturnsInvalidKey()
    {
        var handler = new StubHttpHandler();
        handler.Enqueue(Json(HttpStatusCode.BadRequest,
            """{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT","details":[{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"API_KEY_INVALID","domain":"googleapis.com"}]}}"""));

        var result = await NewClient(handler).GenerateContentAsync(Request);

        Assert.True(result.IsFailure);
        Assert.Equal("Ai.InvalidKey", result.Error.Code);
    }

    [Fact]
    public async Task GenerateContent_ErrorBodyNotJson_ReturnsBadRequestFallback()
    {
        var handler = new StubHttpHandler();
        handler.Enqueue(new HttpResponseMessage(HttpStatusCode.BadRequest)
        {
            Content = new StringContent("<html>Bad Request</html>", Encoding.UTF8, "text/html")
        });

        var result = await NewClient(handler).GenerateContentAsync(Request);

        Assert.True(result.IsFailure);
        Assert.Equal("Ai.BadRequest", result.Error.Code);
    }

    [Fact]
    public async Task GenerateContent_RateLimited_RetriesAfterHeaderDelayThenSucceeds()
    {
        var handler = new StubHttpHandler();
        var tooMany = Json(HttpStatusCode.TooManyRequests,
            """{"error":{"code":429,"message":"Resource has been exhausted","status":"RESOURCE_EXHAUSTED"}}""");
        tooMany.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.Zero); // 0s để test chạy nhanh
        handler.Enqueue(tooMany);
        handler.Enqueue(Success("""{"groups":[]}"""));

        var result = await NewClient(handler).GenerateContentAsync(Request);

        Assert.True(result.IsSuccess);
        Assert.Equal("""{"groups":[]}""", result.Value);
        Assert.Equal(2, handler.Calls.Count); // 429 → retry đúng 1 lần rồi thành công
    }

    [Fact]
    public async Task GenerateContent_FinishReasonMaxTokens_ReturnsTruncated()
    {
        var handler = new StubHttpHandler();
        handler.Enqueue(Json(HttpStatusCode.OK,
            """{"candidates":[{"content":{"parts":[{"text":"{\"groups\":[{\"questio"}]},"finishReason":"MAX_TOKENS"}],"usageMetadata":{"promptTokenCount":100,"candidatesTokenCount":32768,"totalTokenCount":32868}}"""));

        var result = await NewClient(handler).GenerateContentAsync(Request);

        Assert.True(result.IsFailure);
        Assert.Equal("Ai.Truncated", result.Error.Code);
    }

    [Fact]
    public async Task GenerateContent_PromptBlocked_ReturnsBlocked()
    {
        var handler = new StubHttpHandler();
        handler.Enqueue(Json(HttpStatusCode.OK, """{"promptFeedback":{"blockReason":"SAFETY"}}"""));

        var result = await NewClient(handler).GenerateContentAsync(Request);

        Assert.True(result.IsFailure);
        Assert.Equal("Ai.Blocked", result.Error.Code);
        Assert.Contains("SAFETY", result.Error.Message);
    }

    [Fact]
    public async Task GenerateContent_Success_ReturnsTextAndSendsKeyHeaderNotQuery()
    {
        var handler = new StubHttpHandler();
        handler.Enqueue(Success("""{"groups":[]}"""));

        var result = await NewClient(handler).GenerateContentAsync(Request);

        Assert.True(result.IsSuccess);
        Assert.Equal("""{"groups":[]}""", result.Value);
        var call = Assert.Single(handler.Calls);
        Assert.Equal("test-key", call.ApiKeyHeader);
        Assert.DoesNotContain("key=", call.Uri);
        Assert.EndsWith("v1beta/models/gemini-2.5-flash:generateContent", call.Uri);
        Assert.DoesNotContain("thinkingConfig", call.Body); // không truyền budget ⇒ giữ mặc định model
    }

    [Fact]
    public async Task GenerateContent_WithThinkingBudget_SendsThinkingConfig()
    {
        var handler = new StubHttpHandler();
        handler.Enqueue(Success("ok"));

        var result = await NewClient(handler).GenerateContentAsync(Request with { ThinkingBudget = 0 });

        Assert.True(result.IsSuccess);
        var call = Assert.Single(handler.Calls);
        Assert.Contains("\"thinkingConfig\":{\"thinkingBudget\":0}", call.Body);
    }

    [Fact]
    public async Task GenerateContent_WithThinkingLevel_SendsThinkingConfig()
    {
        var handler = new StubHttpHandler();
        handler.Enqueue(Success("ok"));

        var result = await NewClient(handler).GenerateContentAsync(
            Request with { Model = "gemini-3.5-flash", ThinkingLevel = "low" });

        Assert.True(result.IsSuccess);
        var call = Assert.Single(handler.Calls);
        Assert.Contains("\"thinkingConfig\":{\"thinkingLevel\":\"low\"}", call.Body);
        Assert.DoesNotContain("thinkingBudget", call.Body);
    }

    [Fact]
    public async Task ValidateKey_WithModel_NotFound_ReturnsModelNotFound()
    {
        var handler = new StubHttpHandler();
        handler.Enqueue(Json(HttpStatusCode.NotFound,
            """{"error":{"code":404,"message":"models/gemini-2.0-flash is not found","status":"NOT_FOUND"}}"""));

        var result = await NewClient(handler).ValidateKeyAsync("test-key", "gemini-2.0-flash");

        Assert.True(result.IsFailure);
        Assert.Equal("Ai.ModelNotFound", result.Error.Code);
        Assert.Contains("gemini-2.0-flash", result.Error.Message);
        var call = Assert.Single(handler.Calls);
        Assert.EndsWith("v1beta/models/gemini-2.0-flash", call.Uri);
        Assert.Equal("test-key", call.ApiKeyHeader);
    }

    [Fact]
    public void GeminiErrorParser_ParsesStatusReasonAndRetryInfo()
    {
        var parsed = GeminiErrorParser.TryParse(
            """{"error":{"code":429,"message":"Quota exceeded","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"RATE_LIMIT_EXCEEDED"},{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"37s"}]}}""");

        Assert.NotNull(parsed);
        Assert.Equal(429, parsed.Code);
        Assert.Equal("RESOURCE_EXHAUSTED", parsed.Status);
        Assert.Equal("Quota exceeded", parsed.Message);
        Assert.Equal("RATE_LIMIT_EXCEEDED", parsed.Reason);
        Assert.Equal(TimeSpan.FromSeconds(37), parsed.RetryDelay);

        // Duration lẻ giây kiểu protobuf "3.5s".
        var fractional = GeminiErrorParser.TryParse(
            """{"error":{"code":429,"message":"x","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"3.5s"}]}}""");
        Assert.Equal(TimeSpan.FromSeconds(3.5), fractional!.RetryDelay);
    }

    [Fact]
    public void GeminiErrorParser_NonJsonBody_ReturnsNull()
    {
        Assert.Null(GeminiErrorParser.TryParse(null));
        Assert.Null(GeminiErrorParser.TryParse(""));
        Assert.Null(GeminiErrorParser.TryParse("<html>502 Bad Gateway</html>"));
        Assert.Null(GeminiErrorParser.TryParse("""{"notError":true}"""));
    }

    // ----------------- Hạ tầng test -----------------

    private static GeminiClient NewClient(StubHttpHandler handler) =>
        new(new HttpClient(handler) { BaseAddress = new Uri("https://generativelanguage.googleapis.com/") },
            new TestLogger<GeminiClient>());

    private static HttpResponseMessage Json(HttpStatusCode status, string body) =>
        new(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private static HttpResponseMessage Success(string text)
    {
        var body = System.Text.Json.JsonSerializer.Serialize(new
        {
            candidates = new[]
            {
                new { content = new { parts = new[] { new { text } } }, finishReason = "STOP" }
            },
            usageMetadata = new { promptTokenCount = 10, candidatesTokenCount = 5, totalTokenCount = 15 }
        });
        return Json(HttpStatusCode.OK, body);
    }

    /// <summary>Handler giả: trả response theo hàng đợi, ghi lại URI + header key + body tại thời điểm gửi.</summary>
    private sealed class StubHttpHandler : HttpMessageHandler
    {
        private readonly Queue<HttpResponseMessage> _responses = new();
        public List<(string Uri, string? ApiKeyHeader, string? Body)> Calls { get; } = [];

        public void Enqueue(HttpResponseMessage response) => _responses.Enqueue(response);

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var key = request.Headers.TryGetValues("x-goog-api-key", out var values) ? values.FirstOrDefault() : null;
            var body = request.Content is null ? null : await request.Content.ReadAsStringAsync(ct);
            Calls.Add((request.RequestUri!.ToString(), key, body));
            return _responses.Dequeue();
        }
    }

    private sealed class TestLogger<T> : ILogger<T>
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => false;
        public void Log<TState>(
            LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
        }
    }
}
