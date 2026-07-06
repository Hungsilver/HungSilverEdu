using HungSilver.Application.Common.Models;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.Exams;

/// <summary>
/// Bộ lọc Ngân hàng câu hỏi — kế thừa PagedRequest (Search + clamp PageSize 1..100 có sẵn).
/// Search khớp nội dung câu hỏi / tên đề / mã + tên tài liệu.
/// </summary>
public sealed class ExamQuestionBankFilter : PagedRequest
{
    public Guid? SubjectId { get; set; }
    public string? GradeBand { get; set; }
    public Guid? MaterialId { get; set; }
    public Guid? ExamId { get; set; }
    public ExamQuestionType? Type { get; set; }
    public ExamStatus? ExamStatus { get; set; }
}

/// <summary>1 câu hỏi trong ngân hàng: câu + ngữ cảnh đề nguồn/tài liệu/môn/khối (join qua Exam, không bảng mới).</summary>
public sealed record ExamQuestionBankItemDto(
    Guid QuestionId, Guid? GroupId, int OrderNo, ExamQuestionType Type, string Stem,
    string? OptionsJson, string AnswerJson, string? Explanation, decimal Points,
    Guid ExamId, string ExamTitle, ExamStatus ExamStatus,
    Guid? MaterialId, string? MaterialCode, string? MaterialTitle,
    Guid? SubjectId, string? SubjectName, string? GradeBand, DateTime CreatedAt);

/// <summary>Toàn bộ id câu hỏi khớp bộ lọc (phục vụ "chọn tất cả") — cap 1000, Truncated=true nếu bị cắt.</summary>
public sealed record ExamQuestionIdsDto(IReadOnlyList<Guid> Ids, int TotalCount, bool Truncated);

/// <summary>Tạo đề thủ công từ các câu hỏi đã chọn trong ngân hàng (copy câu + nhóm ngữ liệu).</summary>
public sealed record CreateExamFromQuestionsRequest(
    string Title, string? Description, Guid? SubjectId, string? GradeBand,
    int DurationMinutes, List<Guid> QuestionIds);

public sealed record CreateExamFromQuestionsResult(Guid ExamId, int QuestionCount);

public interface IExamQuestionBankService
{
    Task<Result<PagedResult<ExamQuestionBankItemDto>>> GetPagedAsync(ExamQuestionBankFilter filter, CancellationToken ct = default);
    Task<Result<ExamQuestionIdsDto>> GetIdsAsync(ExamQuestionBankFilter filter, CancellationToken ct = default);
    Task<Result<CreateExamFromQuestionsResult>> CreateExamFromQuestionsAsync(CreateExamFromQuestionsRequest request, Guid? userId, CancellationToken ct = default);
    /// <summary>Nhân bản nguyên trạng 1 đề (meta + nhóm + câu, giữ điểm/thứ tự) thành đề Draft mới.</summary>
    Task<Result<CreateExamFromQuestionsResult>> DuplicateExamAsync(Guid examId, Guid? userId, CancellationToken ct = default);
}
