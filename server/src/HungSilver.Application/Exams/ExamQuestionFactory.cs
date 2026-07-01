using System.Text.Json;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.Exams;

/// <summary>
/// Dựng + validate JSON lựa chọn/đáp án cho 1 câu hỏi theo loại. Dùng chung cho sinh đề (bỏ câu hỏng) và
/// sửa đề (trả lỗi cụ thể). Bảo đảm đáp án LUÔN nằm trong lựa chọn ⇒ không sinh/lưu câu sai cấu trúc.
/// </summary>
public static class ExamQuestionFactory
{
    public static Result<ExamQuestionContent> Build(
        ExamQuestionType type,
        IReadOnlyList<GenOption>? options,
        IReadOnlyList<GenOption>? optionsRight,
        string? answerKey,
        IReadOnlyList<string>? answerBlanks,
        IReadOnlyList<string>? wordBox,
        IReadOnlyList<GenPair>? answerPairs)
    {
        switch (type)
        {
            case ExamQuestionType.SingleChoice:
            {
                var opts = (options ?? []).Where(o => !string.IsNullOrWhiteSpace(o.Key) && o.Text is not null).ToList();
                if (opts.Count < 2) return Err("Câu trắc nghiệm cần ít nhất 2 lựa chọn.");
                if (string.IsNullOrWhiteSpace(answerKey)) return Err("Thiếu đáp án đúng.");
                var key = answerKey.Trim();
                if (!opts.Any(o => string.Equals(o.Key!.Trim(), key, StringComparison.OrdinalIgnoreCase)))
                    return Err("Đáp án đúng không nằm trong các lựa chọn.");
                return new ExamQuestionContent(
                    JsonSerializer.Serialize(opts.Select(o => new { key = o.Key!.Trim(), text = o.Text!.Trim() })),
                    JsonSerializer.Serialize(new { key }));
            }
            case ExamQuestionType.TrueFalse:
            {
                var k = answerKey?.Trim().ToLowerInvariant();
                bool value;
                if (k is "true" or "t" or "đúng" or "yes") value = true;
                else if (k is "false" or "f" or "sai" or "no") value = false;
                else return Err("Đáp án Đúng/Sai không hợp lệ.");
                return new ExamQuestionContent(null, JsonSerializer.Serialize(new { value }));
            }
            case ExamQuestionType.FillBlank:
            {
                var blanks = (answerBlanks ?? [])
                    .Select(b => (b ?? string.Empty).Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                    .Where(a => a.Length > 0)
                    .ToList();
                if (blanks.Count == 0) return Err("Câu điền từ cần ít nhất 1 ô có đáp án.");
                return new ExamQuestionContent(
                    JsonSerializer.Serialize(new { blanks = blanks.Count, wordBox }),
                    JsonSerializer.Serialize(new { blanks }));
            }
            case ExamQuestionType.Matching:
            {
                var left = (options ?? []).Where(o => !string.IsNullOrWhiteSpace(o.Key) && o.Text is not null).ToList();
                var right = (optionsRight ?? []).Where(o => !string.IsNullOrWhiteSpace(o.Key) && o.Text is not null).ToList();
                var pairs = (answerPairs ?? []).Where(p => !string.IsNullOrWhiteSpace(p.Left) && !string.IsNullOrWhiteSpace(p.Right)).ToList();
                if (left.Count == 0 || right.Count == 0) return Err("Câu nối cần cả 2 cột.");
                if (pairs.Count == 0) return Err("Câu nối cần ít nhất 1 cặp đáp án.");
                var lk = left.Select(o => o.Key!.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
                var rk = right.Select(o => o.Key!.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
                if (!pairs.All(p => lk.Contains(p.Left!.Trim()) && rk.Contains(p.Right!.Trim())))
                    return Err("Cặp đáp án tham chiếu lựa chọn không tồn tại.");
                return new ExamQuestionContent(
                    JsonSerializer.Serialize(new
                    {
                        left = left.Select(o => new { key = o.Key!.Trim(), text = o.Text!.Trim() }),
                        right = right.Select(o => new { key = o.Key!.Trim(), text = o.Text!.Trim() })
                    }),
                    JsonSerializer.Serialize(new { pairs = pairs.ToDictionary(p => p.Left!.Trim(), p => p.Right!.Trim()) }));
            }
            default:
                return Err("Loại câu hỏi không hợp lệ.");
        }
    }

    private static Result<ExamQuestionContent> Err(string msg) =>
        Result.Failure<ExamQuestionContent>(Error.Validation("Exam.QuestionInvalid", msg));
}

/// <summary>Cặp JSON lựa chọn (có thể null) + đáp án (bắt buộc) đã validate của một câu.</summary>
public sealed record ExamQuestionContent(string? OptionsJson, string AnswerJson);
