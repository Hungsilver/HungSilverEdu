using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Notifications;

public interface INotificationService
{
    /// <summary>Tạo thông báo + gửi theo kênh (Email gửi thật nếu có email; Zalo/Messenger để gửi tay).</summary>
    Task<Result<NotificationResultDto>> CreateAndDispatchAsync(CreateNotificationRequest request, CancellationToken ct = default);
}
