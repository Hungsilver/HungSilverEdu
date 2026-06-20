using HungSilver.Application.Abstractions;
using HungSilver.Domain.Enums;

namespace HungSilver.Infrastructure.Notifications;

public sealed class NotificationDispatcher(IEnumerable<INotificationSender> senders) : INotificationDispatcher
{
    public async Task<DispatchOutcome> DispatchAsync(NotificationChannel channel, NotificationMessage message, CancellationToken ct = default)
    {
        var sender = senders.FirstOrDefault(s => s.Channel == channel);
        if (sender is null)
            return new DispatchOutcome(NotificationDeliveryStatus.Manual);

        var result = await sender.SendAsync(message, ct);

        // Email gửi tự động; Zalo/Messenger hiện gửi tay → Manual dù SendAsync trả Success.
        if (channel == NotificationChannel.Email)
            return result.IsSuccess
                ? new DispatchOutcome(NotificationDeliveryStatus.Sent)
                : new DispatchOutcome(NotificationDeliveryStatus.Failed, result.Error.Message);

        return new DispatchOutcome(NotificationDeliveryStatus.Manual);
    }
}
