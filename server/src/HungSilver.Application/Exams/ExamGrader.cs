using System.Text.Json;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.Exams;

/// <summary>
/// Tự chấm 1 câu: so đáp án học viên (<c>responseJson</c>) với đáp án đúng (<c>answerJson</c>) theo loại.
/// Trả <c>(đúng hoàn toàn, tỉ lệ điểm [0..1])</c>. Matching/FillBlank chấm TỪNG PHẦN.
/// </summary>
public static class ExamGrader
{
    private static readonly JsonSerializerOptions Opts = new() { PropertyNameCaseInsensitive = true };

    public static (bool correct, decimal fraction) Grade(ExamQuestionType type, string answerJson, string? responseJson)
    {
        if (string.IsNullOrWhiteSpace(responseJson)) return (false, 0m);
        try
        {
            switch (type)
            {
                case ExamQuestionType.SingleChoice:
                {
                    var a = JsonSerializer.Deserialize<KeyDto>(answerJson, Opts);
                    var r = JsonSerializer.Deserialize<KeyDto>(responseJson, Opts);
                    var ok = !string.IsNullOrWhiteSpace(a?.Key) && !string.IsNullOrWhiteSpace(r?.Key)
                             && string.Equals(a!.Key!.Trim(), r!.Key!.Trim(), StringComparison.OrdinalIgnoreCase);
                    return (ok, ok ? 1m : 0m);
                }
                case ExamQuestionType.TrueFalse:
                {
                    var a = JsonSerializer.Deserialize<ValueDto>(answerJson, Opts);
                    var r = JsonSerializer.Deserialize<ValueDto>(responseJson, Opts);
                    var ok = a is not null && r is not null && a.Value == r.Value;
                    return (ok, ok ? 1m : 0m);
                }
                case ExamQuestionType.FillBlank:
                {
                    var accepted = JsonSerializer.Deserialize<BlanksAnswerDto>(answerJson, Opts)?.Blanks;
                    var given = JsonSerializer.Deserialize<BlanksResponseDto>(responseJson, Opts)?.Blanks;
                    if (accepted is null || accepted.Count == 0) return (false, 0m);
                    var correct = 0;
                    for (var i = 0; i < accepted.Count; i++)
                    {
                        var g = (given is not null && i < given.Count) ? Normalize(given[i]) : string.Empty;
                        if (g.Length > 0 && accepted[i].Any(x => Normalize(x) == g)) correct++;
                    }
                    return (correct == accepted.Count, (decimal)correct / accepted.Count);
                }
                case ExamQuestionType.Matching:
                {
                    var ans = JsonSerializer.Deserialize<PairsDto>(answerJson, Opts)?.Pairs;
                    var res = JsonSerializer.Deserialize<PairsDto>(responseJson, Opts)?.Pairs;
                    if (ans is null || ans.Count == 0) return (false, 0m);
                    var correct = ans.Count(kv => res is not null
                        && res.TryGetValue(kv.Key, out var v)
                        && string.Equals(v?.Trim(), kv.Value?.Trim(), StringComparison.OrdinalIgnoreCase));
                    return (correct == ans.Count, (decimal)correct / ans.Count);
                }
                default:
                    return (false, 0m);
            }
        }
        catch (JsonException)
        {
            return (false, 0m);
        }
    }

    /// <summary>Chuẩn hóa để so khớp: trim + lower + gộp khoảng trắng.</summary>
    private static string Normalize(string? s) =>
        string.IsNullOrWhiteSpace(s)
            ? string.Empty
            : string.Join(' ', s.Trim().ToLowerInvariant().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    private sealed class KeyDto { public string? Key { get; set; } }
    private sealed class ValueDto { public bool Value { get; set; } }
    private sealed class BlanksAnswerDto { public List<List<string>>? Blanks { get; set; } }
    private sealed class BlanksResponseDto { public List<string>? Blanks { get; set; } }
    private sealed class PairsDto { public Dictionary<string, string>? Pairs { get; set; } }
}
