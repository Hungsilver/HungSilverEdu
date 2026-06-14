using HungSilver.Application.Common.Models;
using HungSilver.Application.Students;
using HungSilver.Domain.Common;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/students")]
[Authorize(Policy = "TeacherOrAdmin")]
public class StudentsController(IStudentService studentService) : ControllerBase
{
    /// <summary>Admin: tất cả học sinh; Teacher: chỉ học sinh trong lớp của mình.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<StudentDto>>> GetStudents(
        [FromQuery] PagedRequest request,
        [FromQuery] bool includeDeleted = false,
        CancellationToken ct = default)
    {
        var canSeeDeleted = includeDeleted && User.IsInRole(AppRoles.Admin);
        return (await studentService.GetPagedAsync(request, canSeeDeleted, ct)).ToActionResult();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<StudentDto>> GetStudent(Guid id, CancellationToken ct) =>
        (await studentService.GetByIdAsync(id, ct)).ToActionResult();

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<StudentDto>> Create(CreateStudentRequest request, CancellationToken ct) =>
        (await studentService.CreateAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<StudentDto>> Update(Guid id, UpdateStudentRequest request, CancellationToken ct) =>
        (await studentService.UpdateAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await studentService.DeleteAsync(id, ct)).ToActionResult();

    [HttpPost("{id:guid}/restore")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Restore(Guid id, CancellationToken ct) =>
        (await studentService.RestoreAsync(id, ct)).ToActionResult();

    /// <summary>Liên kết hồ sơ học sinh với một tài khoản (để học sinh đăng nhập portal).</summary>
    [HttpPut("{id:guid}/link-user")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> LinkUser(Guid id, LinkUserRequest request, CancellationToken ct) =>
        (await studentService.LinkUserAsync(id, request.UserId, ct)).ToActionResult();
}
