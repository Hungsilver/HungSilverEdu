using HungSilver.Application.Reports;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Authorize(Policy = "TeacherOrAdmin")]
public class SessionReportsController(ISessionReportService reportService) : ControllerBase
{
    [HttpPost("api/sessions/{sessionId:guid}/report/generate")]
    public async Task<ActionResult<GeneratedReportDto>> GenerateSessionNotice(Guid sessionId, CancellationToken ct) =>
        (await reportService.GenerateSessionNoticeAsync(sessionId, ct)).ToActionResult();

    [HttpPost("api/classes/{classId:guid}/schedule-notice/generate")]
    public async Task<ActionResult<GeneratedReportDto>> GenerateScheduleNotice(Guid classId, CancellationToken ct) =>
        (await reportService.GenerateScheduleNoticeAsync(classId, ct)).ToActionResult();
}
