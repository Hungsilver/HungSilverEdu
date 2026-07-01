using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Một đề trắc nghiệm (sinh từ tài liệu bằng AI, hoặc tạo tay). Không khóa ngoại.</summary>
public class Exam : BaseEntity
{
    /// <summary>Tài liệu nguồn (kho học liệu) sinh ra đề này. Tùy chọn.</summary>
    public Guid? MaterialId { get; set; }

    /// <summary>Môn học của đề (Guid + snapshot tên, không FK).</summary>
    public Guid? SubjectId { get; set; }
    public string? SubjectName { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }

    /// <summary>Khối lớp (nhãn tự do, đồng bộ Settings Class.GradeBands). Tùy chọn.</summary>
    public string? GradeBand { get; set; }

    /// <summary>Thời gian làm bài mặc định (phút).</summary>
    public int DurationMinutes { get; set; } = 60;

    /// <summary>Thang điểm tổng (mặc định 10).</summary>
    public decimal TotalPoints { get; set; } = 10m;

    public ExamStatus Status { get; set; } = ExamStatus.Draft;
    public ExamGenSource Source { get; set; } = ExamGenSource.Extracted;

    /// <summary>Ngôn ngữ nội dung đề (mặc định tiếng Anh).</summary>
    public string? Language { get; set; } = "en";

    public Guid? CreatedByUserId { get; set; }
}
