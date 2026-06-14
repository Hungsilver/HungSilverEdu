using HungSilver.Application.Notifications;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize(Policy = "TeacherOrAdmin")]
public class NotificationsController(INotificationService notificationService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<NotificationResultDto>> Send(CreateNotificationRequest request, CancellationToken ct) =>
        (await notificationService.CreateAndDispatchAsync(request, ct)).ToActionResult();
}
