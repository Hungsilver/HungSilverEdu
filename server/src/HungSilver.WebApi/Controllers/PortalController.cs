using HungSilver.Application.Portal;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/portal")]
[Authorize]
public class PortalController(IPortalService portalService) : ControllerBase
{
    /// <summary>Hồ sơ + tiến độ của chính học sinh đang đăng nhập.</summary>
    [HttpGet("me")]
    public async Task<ActionResult<PortalProfileDto>> Me(CancellationToken ct) =>
        (await portalService.GetMyProfileAsync(ct)).ToActionResult();

    /// <summary>Bài tập của học sinh (từ các lớp đang học) kèm trạng thái nộp.</summary>
    [HttpGet("assignments")]
    public async Task<ActionResult<List<PortalAssignmentDto>>> MyAssignments(CancellationToken ct) =>
        (await portalService.GetMyAssignmentsAsync(ct)).ToActionResult();

    /// <summary>Học sinh nộp bài (đánh dấu đã làm, kèm link/ghi chú).</summary>
    [HttpPost("assignments/{id:guid}/submit")]
    public async Task<ActionResult> Submit(Guid id, SubmitAssignmentRequest request, CancellationToken ct) =>
        (await portalService.SubmitAssignmentAsync(id, request, ct)).ToActionResult();
}
