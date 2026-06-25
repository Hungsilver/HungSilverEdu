using HungSilver.Application.Accounts;
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
    IAccountProvisioningService accountProvisioning) : ControllerBase
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

    // ---------------------------------------------------------------- Tài khoản đăng nhập

    /// <summary>Cấp tài khoản đăng nhập cho học sinh (tên đăng nhập = Mã HV, mật khẩu mặc định/nhập).</summary>
    [HttpPost("{id:guid}/account")]
    public async Task<ActionResult<AccountProvisionResultDto>> ProvisionAccount(Guid id, ProvisionAccountRequest request, CancellationToken ct) =>
        (await accountProvisioning.ProvisionStudentAsync(id, new ProvisionAccountOptions(request.Password, request.LoginEmail), ct)).ToActionResult();

    /// <summary>Cấp tài khoản hàng loạt cho nhiều học sinh chưa có tài khoản.</summary>
    [HttpPost("accounts/provision")]
    public async Task<ActionResult<BulkProvisionResultDto>> ProvisionAccounts(BulkProvisionRequest request, CancellationToken ct) =>
        Ok(await accountProvisioning.ProvisionStudentsAsync(request.Ids, new ProvisionAccountOptions(request.Password), ct));

    /// <summary>Đặt lại mật khẩu tài khoản học sinh (trống ⇒ mật khẩu mặc định, bắt đổi lần đầu).</summary>
    [HttpPost("{id:guid}/account/reset-password")]
    public async Task<ActionResult> ResetPassword(Guid id, ResetPasswordRequest request, CancellationToken ct) =>
        (await accountProvisioning.ResetStudentPasswordAsync(id, request.Password, ct)).ToActionResult();

    /// <summary>Khóa/mở khóa đăng nhập tài khoản học sinh.</summary>
    [HttpPost("{id:guid}/account/lock")]
    public async Task<ActionResult> SetLocked(Guid id, SetAccountLockedRequest request, CancellationToken ct) =>
        (await accountProvisioning.SetStudentLockedAsync(id, request.Locked, ct)).ToActionResult();

    /// <summary>Gỡ liên kết tài khoản khỏi học sinh.</summary>
    [HttpDelete("{id:guid}/account")]
    public async Task<ActionResult> UnlinkAccount(Guid id, CancellationToken ct) =>
        (await accountProvisioning.UnlinkStudentAsync(id, ct)).ToActionResult();

    /// <summary>Liên kết hồ sơ học sinh với một tài khoản (role Học sinh) đã tồn tại.</summary>
    [HttpPut("{id:guid}/link-user")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> LinkUser(Guid id, LinkUserRequest request, CancellationToken ct) =>
        (await studentService.LinkUserAsync(id, request.UserId, ct)).ToActionResult();
}
