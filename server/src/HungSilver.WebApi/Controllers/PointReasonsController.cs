using HungSilver.Application.PointReasons;
using HungSilver.Domain.Enums;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/point-reasons")]
[Authorize(Policy = "TeacherOrAdmin")]
public class PointReasonsController(IPointReasonService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<PointReasonDto>>> GetAll(
        [FromQuery] PointReasonType? type = null,
        [FromQuery] bool includeInactive = false,
        CancellationToken ct = default) =>
        (await service.GetAllAsync(type, includeInactive, ct)).ToActionResult();

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<PointReasonDto>> Create(CreatePointReasonRequest request, CancellationToken ct) =>
        (await service.CreateAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<PointReasonDto>> Update(Guid id, UpdatePointReasonRequest request, CancellationToken ct) =>
        (await service.UpdateAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await service.DeleteAsync(id, ct)).ToActionResult();
}
