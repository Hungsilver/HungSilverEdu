using HungSilver.Application.Classes;
using HungSilver.Application.Common.Models;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/classes")]
[Authorize(Policy = "TeacherOrAdmin")]
public class ClassesController(IClassService classService) : ControllerBase
{
    /// <summary>Admin: tất cả lớp; Teacher: chỉ lớp do mình phụ trách.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<ClassListItemDto>>> GetClasses(
        [FromQuery] PagedRequest request,
        [FromQuery] bool includeDeleted = false,
        CancellationToken ct = default) =>
        (await classService.GetPagedAsync(request, includeDeleted, ct)).ToActionResult();

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ClassDto>> GetClass(Guid id, CancellationToken ct) =>
        (await classService.GetByIdAsync(id, ct)).ToActionResult();

    [HttpGet("{id:guid}/roster")]
    public async Task<ActionResult<List<RosterItemDto>>> GetRoster(Guid id, CancellationToken ct) =>
        (await classService.GetRosterAsync(id, ct)).ToActionResult();

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<ClassDto>> Create(CreateClassRequest request, CancellationToken ct) =>
        (await classService.CreateAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<ClassDto>> Update(Guid id, UpdateClassRequest request, CancellationToken ct) =>
        (await classService.UpdateAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await classService.DeleteAsync(id, ct)).ToActionResult();

    [HttpPost("{id:guid}/restore")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Restore(Guid id, CancellationToken ct) =>
        (await classService.RestoreAsync(id, ct)).ToActionResult();

    [HttpPut("{id:guid}/teacher")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> AssignTeacher(Guid id, AssignTeacherRequest request, CancellationToken ct) =>
        (await classService.AssignTeacherAsync(id, request, ct)).ToActionResult();

    [HttpPost("{id:guid}/enroll")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Enroll(Guid id, EnrollStudentRequest request, CancellationToken ct) =>
        (await classService.EnrollAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}/students/{studentId:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Withdraw(Guid id, Guid studentId, CancellationToken ct) =>
        (await classService.WithdrawAsync(id, studentId, ct)).ToActionResult();
}
