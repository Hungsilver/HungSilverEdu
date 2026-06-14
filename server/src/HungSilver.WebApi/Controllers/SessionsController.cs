using HungSilver.Application.Sessions;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/sessions")]
[Authorize(Policy = "TeacherOrAdmin")]
public class SessionsController(ISessionService sessionService) : ControllerBase
{
    [HttpGet("{sessionId:guid}/sheet")]
    public async Task<ActionResult<SessionSheetDto>> GetSheet(Guid sessionId, CancellationToken ct) =>
        (await sessionService.GetSessionSheetAsync(sessionId, ct)).ToActionResult();

    [HttpPut("{sessionId:guid}/attendance")]
    public async Task<ActionResult> SaveAttendance(Guid sessionId, SaveAttendanceRequest request, CancellationToken ct) =>
        (await sessionService.SaveAttendanceAsync(sessionId, request, ct)).ToActionResult();

    [HttpPost("{sessionId:guid}/points")]
    public async Task<ActionResult<PointEntryDto>> AddPoint(Guid sessionId, AddPointRequest request, CancellationToken ct) =>
        (await sessionService.AddPointAsync(sessionId, request, ct)).ToActionResult();

    [HttpDelete("points/{entryId:guid}")]
    public async Task<ActionResult> RemovePoint(Guid entryId, CancellationToken ct) =>
        (await sessionService.RemovePointAsync(entryId, ct)).ToActionResult();

    // Định tuyến tuyệt đối: các thao tác gắn với học sinh.
    [HttpGet("~/api/students/{studentId:guid}/progress")]
    public async Task<ActionResult<StudentProgressDto>> GetStudentProgress(Guid studentId, CancellationToken ct) =>
        (await sessionService.GetStudentProgressAsync(studentId, ct)).ToActionResult();

    [HttpPost("~/api/students/{studentId:guid}/redeem")]
    public async Task<ActionResult> Redeem(Guid studentId, RedeemRewardRequest request, CancellationToken ct) =>
        (await sessionService.RedeemRewardAsync(studentId, request, ct)).ToActionResult();
}
