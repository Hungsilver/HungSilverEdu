using HungSilver.Application.Common.Models;
using HungSilver.Application.Teachers;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/teachers")]
[Authorize(Policy = "TeacherOrAdmin")]
public class TeachersController(ITeacherService teacherService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<TeacherProfileDto>>> GetTeachers(
        [FromQuery] PagedRequest request,
        [FromQuery] bool includeDeleted = false,
        CancellationToken ct = default) =>
        (await teacherService.GetPagedAsync(request, includeDeleted, ct)).ToActionResult();

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TeacherDetailDto>> GetTeacher(Guid id, CancellationToken ct) =>
        (await teacherService.GetByIdAsync(id, ct)).ToActionResult();

    [HttpPost]
    public async Task<ActionResult<TeacherProfileDto>> Create(CreateTeacherRequest request, CancellationToken ct) =>
        (await teacherService.CreateAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TeacherProfileDto>> Update(Guid id, UpdateTeacherRequest request, CancellationToken ct) =>
        (await teacherService.UpdateAsync(id, request, ct)).ToActionResult();

    [HttpPost("accounts")]
    public async Task<ActionResult<TeacherProfileDto>> CreateAccount(CreateTeacherAccountRequest request, CancellationToken ct) =>
        (await teacherService.CreateAccountAsync(request, ct)).ToActionResult();

    [HttpGet("unlinked-users")]
    public async Task<ActionResult<List<UnlinkedUserDto>>> GetUnlinkedUsers(CancellationToken ct) =>
        (await teacherService.GetUnlinkedUsersAsync(ct)).ToActionResult();

    [HttpPut("{id:guid}/link-account")]
    public async Task<ActionResult<TeacherProfileDto>> LinkAccount(Guid id, LinkAccountRequest request, CancellationToken ct) =>
        (await teacherService.LinkAccountAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}/link-account")]
    public async Task<ActionResult<TeacherProfileDto>> UnlinkAccount(Guid id, CancellationToken ct) =>
        (await teacherService.UnlinkAccountAsync(id, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await teacherService.DeleteAsync(id, ct)).ToActionResult();
}
