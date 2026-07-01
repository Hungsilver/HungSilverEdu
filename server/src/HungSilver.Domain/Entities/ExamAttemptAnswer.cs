using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>Câu trả lời của học viên cho một câu hỏi trong lượt làm bài. Không khóa ngoại.</summary>
public class ExamAttemptAnswer : BaseEntity
{
    public Guid AttemptId { get; set; }
    public Guid QuestionId { get; set; }

    /// <summary>Đáp án học viên chọn (JSON tùy loại): {key}/{value}/{blanks}/{pairs}.</summary>
    public string? ResponseJson { get; set; }

    /// <summary>Kết quả chấm (null khi chưa chấm).</summary>
    public bool? IsCorrect { get; set; }
    public decimal AwardedPoints { get; set; }
}
