using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Lượt làm bài của một học viên cho một lượt giao đề. 1 học viên = 1 lượt/đề (unique index). Không khóa ngoại.</summary>
public class ExamAttempt : BaseEntity
{
    public Guid ExamAssignmentId { get; set; }
    public Guid StudentId { get; set; }

    public ExamAttemptStatus Status { get; set; } = ExamAttemptStatus.InProgress;

    /// <summary>Mốc bắt đầu (server-authoritative) — hết giờ = StartedAt + DurationMinutes.</summary>
    public DateTime? StartedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }

    /// <summary>Điểm đạt (thang 10) sau khi chấm.</summary>
    public decimal? Score { get; set; }
    public int? CorrectCount { get; set; }
    public int? TotalCount { get; set; }
}
