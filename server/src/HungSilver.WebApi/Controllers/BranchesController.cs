using HungSilver.Application.Branches;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/branches")]
[Authorize(Policy = "TeacherOrAdmin")]
public class BranchesController(IBranchService branchService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<BranchDto>>> GetAll(
        [FromQuery] bool includeInactive = false, CancellationToken ct = default) =>
        (await branchService.GetAllAsync(includeInactive, ct)).ToActionResult();

    [HttpPost]
    public async Task<ActionResult<BranchDto>> Create(CreateBranchRequest request, CancellationToken ct) =>
        (await branchService.CreateAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<BranchDto>> Update(Guid id, UpdateBranchRequest request, CancellationToken ct) =>
        (await branchService.UpdateAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await branchService.DeleteAsync(id, ct)).ToActionResult();
}
