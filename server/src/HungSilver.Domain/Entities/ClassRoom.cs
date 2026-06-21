using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>
/// Lớp học (Module 4). Đặt tên ClassRoom vì "class" là keyword; map sang bảng "Classes".
/// CurrentSize/AverageScore/AttendanceRate được tính khi đọc, không lưu.
/// </summary>
public class ClassRoom : BaseEntity
{
    /// <summary>Mã lớp duy nhất. Để trống khi nhập thì service tự sinh.</summary>
    public string ClassCode { get; set; } = UniqueCodeGenerator.Next("LH");

    public string Name { get; set; } = string.Empty;

    /// <summary>Legacy: AppUser.Id giáo viên. Logic mới dùng TeacherProfileId.</summary>
    public Guid TeacherId { get; set; }

    /// <summary>Hồ sơ giáo viên phụ trách (TeacherProfile.Id) — Guid thuần, không FK.</summary>
    public Guid? TeacherProfileId { get; set; }

    /// <summary>Tên giáo viên snapshot tại thời điểm lưu lớp.</summary>
    public string? TeacherName { get; set; }

    /// <summary>Cơ sở (Branch.Id) — Guid thuần, không FK. Null = chưa phân cơ sở (Đợt 8).</summary>
    public Guid? BranchId { get; set; }

    /// <summary>Mã cơ sở snapshot tại thời điểm lưu lớp.</summary>
    public string? BranchCode { get; set; }

    /// <summary>Tên cơ sở snapshot tại thời điểm lưu lớp.</summary>
    public string? BranchName { get; set; }

    /// <summary>Môn học (Subject.Id) — Guid thuần, không FK. Null = chưa phân môn (Đợt 7).</summary>
    public Guid? SubjectId { get; set; }

    /// <summary>Tên môn học snapshot tại thời điểm lưu lớp.</summary>
    public string? SubjectName { get; set; }

    /// <summary>Khối lớp legacy dạng text. Logic mới dùng GradeId/GradeName.</summary>
    public string? GradeBand { get; set; }

    /// <summary>Danh mục khối (GradeCategory.Id) — Guid thuần, không FK.</summary>
    public Guid? GradeId { get; set; }

    /// <summary>Tên khối snapshot tại thời điểm lưu lớp.</summary>
    public string? GradeName { get; set; }

    /// <summary>Học phí mặc định của lớp, dùng khi lập bill học phí.</summary>
    public decimal TuitionFee { get; set; }

    public Guid? CurriculumId { get; set; }
    public int MaxCapacity { get; set; }

    /// <summary>Mô tả lịch học dạng text (lịch chi tiết lưu ở ClassScheduleSlot).</summary>
    public string? Schedule { get; set; }

    public DateOnly? StartDate { get; set; }
    public bool IsActive { get; set; } = true;
}
