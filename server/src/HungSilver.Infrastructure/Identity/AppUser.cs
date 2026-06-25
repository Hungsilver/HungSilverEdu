using HungSilver.Domain.Common;
using Microsoft.AspNetCore.Identity;

namespace HungSilver.Infrastructure.Identity;

public class AppUser : IdentityUser<Guid>, IAuditable, ISoftDeletable
{
    public string? FullName { get; set; }
    public string? AvatarUrl { get; set; }

    /// <summary>Bắt buộc đổi mật khẩu ở lần đăng nhập kế tiếp (tài khoản vừa được cấp / vừa reset).</summary>
    public bool MustChangePassword { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}
