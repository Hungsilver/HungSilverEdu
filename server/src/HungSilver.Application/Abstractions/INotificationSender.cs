using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.Abstractions;

public sealed record NotificationMessage(string To, string Subject, string Body);

/// <summary>Một kênh gửi thông báo. Email gửi thật; Zalo/Messenger hiện là stub (gửi tay).</summary>
public interface INotificationSender
{
    NotificationChannel Channel { get; }
    Task<Result> SendAsync(NotificationMessage message, CancellationToken ct = default);
}

/// <summary>Điều phối gửi theo kênh; trả về trạng thái giao (Sent/Failed/Manual).</summary>
public interface INotificationDispatcher
{
    Task<NotificationDeliveryStatus> DispatchAsync(NotificationChannel channel, NotificationMessage message, CancellationToken ct = default);
}
