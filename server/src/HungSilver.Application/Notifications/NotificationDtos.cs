using HungSilver.Domain.Enums;

namespace HungSilver.Application.Notifications;

public enum NotificationTargetScope { All, Class, Student }

public sealed record CreateNotificationRequest(
    string Title,
    string Content,
    NotificationType Type,
    IReadOnlyList<NotificationChannel> Channels,
    NotificationTargetScope Scope,
    Guid? ClassId,
    Guid? StudentId);

public sealed record NotificationDeliveryDto(
    Guid Id,
    Guid? StudentId,
    string StudentName,
    NotificationChannel Channel,
    string RenderedContent,
    NotificationDeliveryStatus Status,
    string? ErrorMessage);

public sealed record NotificationResultDto(Guid NotificationId, IReadOnlyList<NotificationDeliveryDto> Deliveries);
