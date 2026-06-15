using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Bản ghi nộp bài của 1 học sinh cho 1 bài tập (Đợt 4). Không khóa ngoại.</summary>
public class Submission : BaseEntity
{
    public Guid AssignmentId { get; set; }
    public Guid StudentId { get; set; }
    public SubmissionStatus Status { get; set; } = SubmissionStatus.NotSubmitted;
    public DateOnly? SubmittedOn { get; set; }

    /// <summary>Học sinh nộp link bài (Google Drive/ảnh…).</summary>
    public string? Link { get; set; }

    public string? Note { get; set; }
}
