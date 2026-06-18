using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>
/// Lớp học (Module 4). Đặt tên ClassRoom vì "class" là keyword; map sang bảng "Classes".
/// CurrentSize/AverageScore/AttendanceRate được tính khi đọc, không lưu.
/// </summary>
public class ClassRoom : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    /// <summary>Giáo viên phụ trách (AppUser.Id) — Guid thuần, không FK.</summary>
    public Guid TeacherId { get; set; }

    /// <summary>Môn học (Subject.Id) — Guid thuần, không FK. Null = chưa phân môn (Đợt 7).</summary>
    public Guid? SubjectId { get; set; }

    /// <summary>Khối lớp (danh sách chuẩn ở Settings, vd "Khối 6"). Null = chưa phân khối (Đợt 7).</summary>
    public string? GradeBand { get; set; }

    public Guid? CurriculumId { get; set; }
    public int MaxCapacity { get; set; }

    /// <summary>Mô tả lịch học dạng text (lịch chi tiết lưu ở ClassScheduleSlot).</summary>
    public string? Schedule { get; set; }

    public DateOnly? StartDate { get; set; }
    public bool IsActive { get; set; } = true;
}
