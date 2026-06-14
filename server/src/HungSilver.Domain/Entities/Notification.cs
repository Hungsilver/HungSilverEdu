using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Thông báo tạo một lần, gửi nhiều kênh (Module 13).</summary>
public class Notification : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public NotificationType Type { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public Guid? ClassId { get; set; }
    public Guid? StudentId { get; set; }
}
