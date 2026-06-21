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
public class StudentsController(
    IStudentService studentService,
    IStudentAccountService studentAccountService) : ControllerBase
{
    /// <summary>Admin/Teacher: tất cả học sinh.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<StudentDto>>> GetStudents(
        [FromQuery] PagedRequest request,
        [FromQuery] bool includeDeleted = false,
        [FromQuery] Guid? branchId = null,
        [FromQuery] Guid? subjectId = null,
        [FromQuery] Guid? gradeId = null,
        [FromQuery] Guid? teacherProfileId = null,
        CancellationToken ct = default)
    {
        var canSeeDeleted = includeDeleted && User.IsInRole(AppRoles.Admin);
        return (await studentService.GetPagedAsync(request, canSeeDeleted, branchId, subjectId, gradeId, teacherProfileId, ct)).ToActionResult();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<StudentDto>> GetStudent(Guid id, CancellationToken ct) =>
        (await studentService.GetByIdAsync(id, ct)).ToActionResult();

    [HttpPost]
    public async Task<ActionResult<StudentDto>> Create(CreateStudentRequest request, CancellationToken ct) =>
        (await studentService.CreateAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<StudentDto>> Update(Guid id, UpdateStudentRequest request, CancellationToken ct) =>
        (await studentService.UpdateAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await studentService.DeleteAsync(id, ct)).ToActionResult();

    [HttpPost("{id:guid}/restore")]
    public async Task<ActionResult> Restore(Guid id, CancellationToken ct) =>
        (await studentService.RestoreAsync(id, ct)).ToActionResult();

    /// <summary>Liên kết hồ sơ học sinh với một tài khoản (để học sinh đăng nhập portal).</summary>
    [HttpPut("{id:guid}/link-user")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> LinkUser(Guid id, LinkUserRequest request, CancellationToken ct) =>
        (await studentService.LinkUserAsync(id, request.UserId, ct)).ToActionResult();

    /// <summary>Giáo viên/Admin đặt lại mật khẩu tài khoản học sinh.</summary>
    [HttpPut("{id:guid}/password")]
    public async Task<ActionResult> ResetPassword(Guid id, ResetStudentPasswordRequest request, CancellationToken ct) =>
        (await studentAccountService.ResetPasswordAsync(id, request.NewPassword, ct)).ToActionResult();
}
