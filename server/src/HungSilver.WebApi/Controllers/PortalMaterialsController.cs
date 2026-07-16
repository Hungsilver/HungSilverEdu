using HungSilver.Application.Materials;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

/// <summary>
/// Học viên xem tài liệu được giao (role User trên FE; BE guard theo <c>Student.UserId</c> + enrollment trong service).
/// </summary>
[ApiController]
[Route("api/portal/materials")]
[Authorize]
public class PortalMaterialsController(IPortalMaterialService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<PortalMaterialDto>>> MyMaterials(CancellationToken ct) =>
        (await service.GetMyMaterialsAsync(ct)).ToActionResult();

    /// <summary>Đánh dấu đã xem (ghi lần đầu, idempotent) — FE gọi khi học viên mở tài liệu.</summary>
    [HttpPost("{assignmentId:guid}/view")]
    public async Task<ActionResult> MarkViewed(Guid assignmentId, CancellationToken ct) =>
        (await service.MarkViewedAsync(assignmentId, ct)).ToActionResult();
}
