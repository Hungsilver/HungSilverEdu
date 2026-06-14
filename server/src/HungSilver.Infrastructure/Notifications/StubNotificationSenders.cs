using HungSilver.Application.Abstractions;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;

namespace HungSilver.Infrastructure.Notifications;

/// <summary>
/// Stub Zalo: chưa tích hợp API thật (GĐ2). Nội dung đã render được lưu để gửi tay;
/// dispatcher sẽ đánh dấu trạng thái Manual.
/// </summary>
public sealed class ZaloNotificationSender : INotificationSender
{
    public NotificationChannel Channel => NotificationChannel.Zalo;
    public Task<Result> SendAsync(NotificationMessage message, CancellationToken ct = default) =>
        Task.FromResult(Result.Success());
}

/// <summary>Stub Messenger: chưa tích hợp API thật (GĐ2). Gửi tay → Manual.</summary>
public sealed class MessengerNotificationSender : INotificationSender
{
    public NotificationChannel Channel => NotificationChannel.Messenger;
    public Task<Result> SendAsync(NotificationMessage message, CancellationToken ct = default) =>
        Task.FromResult(Result.Success());
}
