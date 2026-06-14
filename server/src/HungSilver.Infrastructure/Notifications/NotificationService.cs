using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Application.Notifications;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Notifications;

public sealed class NotificationService(
    AppDbContext context,
    IClassAccessGuard accessGuard,
    INotificationDispatcher dispatcher,
    ICurrentUser currentUser) : INotificationService
{
    public async Task<Result<NotificationResultDto>> CreateAndDispatchAsync(CreateNotificationRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Content))
            return Result.Failure<NotificationResultDto>(Error.Validation("Notification.Empty", "Thiếu tiêu đề hoặc nội dung."));
        if (request.Channels.Count == 0)
            return Result.Failure<NotificationResultDto>(Error.Validation("Notification.NoChannel", "Chọn ít nhất một kênh gửi."));

        // Xác định danh sách học sinh nhận theo phạm vi (kèm kiểm quyền).
        List<Guid> studentIds;
        switch (request.Scope)
        {
            case NotificationTargetScope.Student:
                if (request.StudentId is null) return Bad("Thiếu học sinh.");
                var sa = await accessGuard.EnsureCanAccessStudentAsync(request.StudentId.Value, ct);
                if (sa.IsFailure) return Result.Failure<NotificationResultDto>(sa.Error);
                studentIds = [request.StudentId.Value];
                break;
            case NotificationTargetScope.Class:
                if (request.ClassId is null) return Bad("Thiếu lớp.");
                var ca = await accessGuard.EnsureCanAccessClassAsync(request.ClassId.Value, ct);
                if (ca.IsFailure) return Result.Failure<NotificationResultDto>(ca.Error);
                studentIds = await context.Enrollments.Where(e => e.ClassId == request.ClassId && e.IsActive)
                    .Select(e => e.StudentId).Distinct().ToListAsync(ct);
                break;
            default:
                var classIds = accessGuard.IsAdmin
                    ? await context.Classes.Select(c => c.Id).ToListAsync(ct)
                    : await context.Classes.Where(c => c.TeacherId == accessGuard.TeacherScopeId).Select(c => c.Id).ToListAsync(ct);
                studentIds = await context.Enrollments.Where(e => classIds.Contains(e.ClassId) && e.IsActive)
                    .Select(e => e.StudentId).Distinct().ToListAsync(ct);
                break;
        }

        var notification = new Notification
        {
            Title = request.Title.Trim(),
            Content = request.Content.Trim(),
            Type = request.Type,
            CreatedByUserId = currentUser.UserId,
            ClassId = request.ClassId,
            StudentId = request.StudentId
        };
        context.Notifications.Add(notification);

        var students = await context.Students.Where(s => studentIds.Contains(s.Id))
            .Select(s => new { s.Id, s.FullName, s.UserId }).ToListAsync(ct);

        // Email người nhận = email tài khoản học sinh đã liên kết (nếu có).
        var userIds = students.Where(s => s.UserId != null).Select(s => s.UserId!.Value).ToList();
        var emails = await context.Users.Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Email, ct);

        var deliveries = new List<NotificationDelivery>();
        var dtos = new List<NotificationDeliveryDto>();

        foreach (var s in students)
        {
            foreach (var channel in request.Channels.Distinct())
            {
                NotificationDeliveryStatus status;
                string? error = null;

                if (channel == NotificationChannel.Email)
                {
                    var email = s.UserId is not null ? emails.GetValueOrDefault(s.UserId.Value) : null;
                    if (string.IsNullOrWhiteSpace(email))
                    {
                        status = NotificationDeliveryStatus.Manual;
                        error = "Học sinh chưa có email liên kết.";
                    }
                    else
                    {
                        status = await dispatcher.DispatchAsync(channel,
                            new NotificationMessage(email, notification.Title, notification.Content), ct);
                    }
                }
                else
                {
                    // Zalo/Messenger: tạo nội dung để gửi tay.
                    status = await dispatcher.DispatchAsync(channel,
                        new NotificationMessage(s.FullName, notification.Title, notification.Content), ct);
                }

                var delivery = new NotificationDelivery
                {
                    NotificationId = notification.Id,
                    StudentId = s.Id,
                    Channel = channel,
                    RenderedContent = notification.Content,
                    Status = status,
                    SentAtUtc = status == NotificationDeliveryStatus.Sent ? DateTime.UtcNow : null,
                    ErrorMessage = error
                };
                deliveries.Add(delivery);
                dtos.Add(new NotificationDeliveryDto(delivery.Id, s.Id, s.FullName, channel, delivery.RenderedContent, status, error));
            }
        }

        context.NotificationDeliveries.AddRange(deliveries);
        await context.SaveChangesAsync(ct);

        return new NotificationResultDto(notification.Id, dtos);
    }

    private static Result<NotificationResultDto> Bad(string msg) =>
        Result.Failure<NotificationResultDto>(Error.Validation("Notification.Validation", msg));
}
