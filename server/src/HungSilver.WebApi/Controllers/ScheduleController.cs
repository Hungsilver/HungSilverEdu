using HungSilver.Application.Schedule;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/schedule")]
[Authorize(Policy = "TeacherOrAdmin")]
public class ScheduleController(IScheduleService scheduleService) : ControllerBase
{
    /// <summary>Buổi học trong khoảng ngày (lịch tháng/tuần). Teacher tự lọc lớp của mình.</summary>
    [HttpGet]
    public async Task<ActionResult<List<CalendarSessionDto>>> GetRange(
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        [FromQuery] Guid? classId,
        CancellationToken ct) =>
        (await scheduleService.GetRangeAsync(from, to, classId, ct)).ToActionResult();

    [HttpGet("classes/{classId:guid}/slots")]
    public async Task<ActionResult<List<ScheduleSlotDto>>> GetSlots(Guid classId, CancellationToken ct) =>
        (await scheduleService.GetSlotsAsync(classId, ct)).ToActionResult();

    [HttpPost("slots")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<ScheduleSlotDto>> AddSlot(CreateSlotRequest request, CancellationToken ct) =>
        (await scheduleService.AddSlotAsync(request, ct)).ToActionResult();

    [HttpDelete("slots/{slotId:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> RemoveSlot(Guid slotId, CancellationToken ct) =>
        (await scheduleService.RemoveSlotAsync(slotId, ct)).ToActionResult();

    [HttpPost("classes/{classId:guid}/generate-sessions")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<int>> GenerateSessions(Guid classId, GenerateSessionsRequest request, CancellationToken ct) =>
        (await scheduleService.GenerateSessionsAsync(classId, request, ct)).ToActionResult();

    [HttpPost("sessions")]
    public async Task<ActionResult<CalendarSessionDto>> CreateSession(CreateSessionRequest request, CancellationToken ct) =>
        (await scheduleService.CreateSessionAsync(request, ct)).ToActionResult();

    [HttpPost("sessions/{sessionId:guid}/cancel")]
    public async Task<ActionResult> CancelSession(Guid sessionId, CancellationToken ct) =>
        (await scheduleService.CancelSessionAsync(sessionId, ct)).ToActionResult();
}
