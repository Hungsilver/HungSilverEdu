using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>Hồ sơ giáo viên nghiệp vụ. UserId chỉ là tài khoản đăng nhập liên kết 1-1, không FK.</summary>
public class TeacherProfile : BaseEntity
{
    public string TeacherCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public string? Address { get; set; }
    public string? Note { get; set; }
    public Guid? UserId { get; set; }
    public bool IsActive { get; set; } = true;
}
