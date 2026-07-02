using System.Globalization;
using System.Text.Json;

namespace HungSilver.Infrastructure.Ai;

/// <summary>
/// Body lỗi chuẩn của Google API: <c>{"error":{code,status,message,details[]}}</c>.
/// <c>Reason</c> lấy từ detail <c>google.rpc.ErrorInfo</c> (vd API_KEY_INVALID);
/// <c>RetryDelay</c> từ <c>google.rpc.RetryInfo.retryDelay</c> (chuỗi Duration dạng "37s"/"3.5s").
/// </summary>
public sealed record GeminiApiError(int? Code, string? Status, string? Message, string? Reason, TimeSpan? RetryDelay);

/// <summary>Parse body lỗi Gemini — trả null nếu body rỗng/không phải JSON lỗi chuẩn (không ném).</summary>
public static class GeminiErrorParser
{
    public static GeminiApiError? TryParse(string? body)
    {
        if (string.IsNullOrWhiteSpace(body)) return null;
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (!doc.RootElement.TryGetProperty("error", out var error) || error.ValueKind != JsonValueKind.Object)
                return null;

            int? code = error.TryGetProperty("code", out var c) && c.ValueKind == JsonValueKind.Number ? c.GetInt32() : null;
            var status = error.TryGetProperty("status", out var s) && s.ValueKind == JsonValueKind.String ? s.GetString() : null;
            var message = error.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.String ? m.GetString() : null;

            string? reason = null;
            TimeSpan? retryDelay = null;
            if (error.TryGetProperty("details", out var details) && details.ValueKind == JsonValueKind.Array)
            {
                foreach (var d in details.EnumerateArray())
                {
                    if (d.ValueKind != JsonValueKind.Object || !d.TryGetProperty("@type", out var t)) continue;
                    var type = t.GetString();
                    if (type == "type.googleapis.com/google.rpc.ErrorInfo" && d.TryGetProperty("reason", out var r))
                        reason ??= r.GetString();
                    else if (type == "type.googleapis.com/google.rpc.RetryInfo" && d.TryGetProperty("retryDelay", out var rd))
                        retryDelay ??= ParseDuration(rd.GetString());
                }
            }

            return new GeminiApiError(code, status, message, reason, retryDelay);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>Duration JSON của protobuf: số giây + hậu tố 's' (vd "37s", "3.5s").</summary>
    private static TimeSpan? ParseDuration(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || !value.EndsWith('s')) return null;
        return double.TryParse(value[..^1], NumberStyles.Float, CultureInfo.InvariantCulture, out var seconds) && seconds >= 0
            ? TimeSpan.FromSeconds(seconds)
            : null;
    }
}
