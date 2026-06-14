using HungSilver.Application.Abstractions;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;

namespace HungSilver.Infrastructure.Notifications;

/// <summary>Gửi email qua SMTP (MailKit). Chưa cấu hình Host → trả lỗi NotConfigured.</summary>
public sealed class EmailNotificationSender(
    IOptions<SmtpOptions> options,
    ILogger<EmailNotificationSender> logger) : INotificationSender
{
    private readonly SmtpOptions _options = options.Value;

    public NotificationChannel Channel => NotificationChannel.Email;

    public async Task<Result> SendAsync(NotificationMessage message, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_options.Host))
            return Result.Failure(Error.Failure("Email.NotConfigured", "Chưa cấu hình SMTP để gửi email."));

        try
        {
            var mime = new MimeMessage();
            mime.From.Add(new MailboxAddress(_options.FromName, _options.FromEmail));
            mime.To.Add(MailboxAddress.Parse(message.To));
            mime.Subject = message.Subject;
            mime.Body = new TextPart("plain") { Text = message.Body };

            using var client = new SmtpClient();
            await client.ConnectAsync(_options.Host, _options.Port,
                _options.UseSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable, ct);

            if (!string.IsNullOrWhiteSpace(_options.User))
                await client.AuthenticateAsync(_options.User, _options.Password, ct);

            await client.SendAsync(mime, ct);
            await client.DisconnectAsync(true, ct);

            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Gửi email thất bại tới {To}", message.To);
            return Result.Failure(Error.Failure("Email.SendFailed", $"Gửi email thất bại: {ex.Message}"));
        }
    }
}
