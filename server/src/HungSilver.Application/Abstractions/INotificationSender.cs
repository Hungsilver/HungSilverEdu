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

/// <summary>Kết quả giao: trạng thái (Sent/Failed/Manual) kèm lý do lỗi (nếu thất bại).</summary>
public sealed record DispatchOutcome(NotificationDeliveryStatus Status, string? Error = null);

/// <summary>Điều phối gửi theo kênh; trả về trạng thái giao + lý do lỗi.</summary>
public interface INotificationDispatcher
{
    Task<DispatchOutcome> DispatchAsync(NotificationChannel channel, NotificationMessage message, CancellationToken ct = default);
}
