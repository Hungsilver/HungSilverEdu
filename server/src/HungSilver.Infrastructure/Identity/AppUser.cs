using HungSilver.Domain.Common;
using Microsoft.AspNetCore.Identity;

namespace HungSilver.Infrastructure.Identity;

public class AppUser : IdentityUser<Guid>, IAuditable, ISoftDeletable
{
    public string? FullName { get; set; }
    public string? AvatarUrl { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}
