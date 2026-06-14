using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>Hồ sơ học sinh (Module 2, 3, 14). Không dùng FK — các tham chiếu là Guid thuần.</summary>
public class Student : BaseEntity
{
    // Thông tin cá nhân
    public string FullName { get; set; } = string.Empty;
    public DateOnly? DateOfBirth { get; set; }
    public string? School { get; set; }
    public string? GradeLevel { get; set; }
    public string? Phone { get; set; }
    public string? ParentName { get; set; }
    public string? ParentPhone { get; set; }
    public string? Address { get; set; }
    public DateOnly EnrollmentDate { get; set; }

    // Thông tin học tập
    public string? EnglishLevel { get; set; }
    public string? LearningGoal { get; set; }
    public decimal? EntryScore { get; set; }
    public string? Curriculum { get; set; }

    /// <summary>Tài khoản đăng nhập (role User) gắn với học sinh — dùng cho portal GĐ2.</summary>
    public Guid? UserId { get; set; }

    public bool IsActive { get; set; } = true;
}
