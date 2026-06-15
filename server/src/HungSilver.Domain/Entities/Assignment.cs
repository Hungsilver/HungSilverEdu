using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>Bài tập giao cho lớp, gắn học liệu nguồn + hạn nộp (Đợt 4). Không khóa ngoại.</summary>
public class Assignment : BaseEntity
{
    public Guid ClassId { get; set; }

    /// <summary>Buổi học gắn bài (tùy chọn).</summary>
    public Guid? ClassSessionId { get; set; }

    /// <summary>Học liệu nguồn từ kho (tùy chọn).</summary>
    public Guid? MaterialId { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Instructions { get; set; }
    public DateOnly? DueDate { get; set; }
    public Guid? AssignedByUserId { get; set; }
}
