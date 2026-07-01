using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Giao một đề cho một lớp (tùy chọn gắn buổi học), hẹn giờ làm bài. Không khóa ngoại.</summary>
public class ExamAssignment : BaseEntity
{
    public Guid ExamId { get; set; }
    public string? ExamTitle { get; set; }  // snapshot tên đề để hiển thị

    public Guid ClassId { get; set; }

    /// <summary>Buổi học gắn bài (tùy chọn).</summary>
    public Guid? ClassSessionId { get; set; }

    public ExamDeliveryMode Mode { get; set; } = ExamDeliveryMode.InClass;

    /// <summary>Thời gian làm bài (phút) — snapshot từ đề, GV có thể chỉnh.</summary>
    public int DurationMinutes { get; set; } = 60;

    /// <summary>Mốc mở làm bài.</summary>
    public DateTime OpenAt { get; set; }

    /// <summary>Hạn nộp (tùy chọn — chủ yếu cho bài về nhà).</summary>
    public DateTime? CloseAt { get; set; }

    /// <summary>Thang điểm tổng (snapshot = 10).</summary>
    public decimal TotalPoints { get; set; } = 10m;

    public ExamAssignmentStatus Status { get; set; } = ExamAssignmentStatus.Open;

    public Guid? AssignedByUserId { get; set; }
}
