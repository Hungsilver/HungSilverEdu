using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Bản gửi thông báo theo từng người nhận + kênh (Module 13).</summary>
public class NotificationDelivery : BaseEntity
{
    public Guid NotificationId { get; set; }
    public Guid? StudentId { get; set; }
    public NotificationChannel Channel { get; set; }
    public string RenderedContent { get; set; } = string.Empty;
    public NotificationDeliveryStatus Status { get; set; } = NotificationDeliveryStatus.Pending;
    public DateTime? SentAtUtc { get; set; }
    public string? ErrorMessage { get; set; }
}
