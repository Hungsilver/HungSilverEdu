using HungSilver.Application.Accounts;
using HungSilver.Application.Common.Models;
using HungSilver.Application.Teachers;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/teachers")]
[Authorize(Policy = "TeacherOrAdmin")]
public class TeachersController(
    ITeacherService teacherService,
    IAccountProvisioningService accountProvisioning) : ControllerBase
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

    // Quản lý hồ sơ giáo viên + liên kết tài khoản là thao tác quản trị — chỉ Admin.
    // GET danh sách/chi tiết giữ TeacherOrAdmin để GV đọc (dropdown/hiển thị).
    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<TeacherProfileDto>> Create(CreateTeacherRequest request, CancellationToken ct) =>
        (await teacherService.CreateAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<TeacherProfileDto>> Update(Guid id, UpdateTeacherRequest request, CancellationToken ct) =>
        (await teacherService.UpdateAsync(id, request, ct)).ToActionResult();

    [HttpPost("accounts")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<TeacherProfileDto>> CreateAccount(CreateTeacherAccountRequest request, CancellationToken ct) =>
        (await teacherService.CreateAccountAsync(request, ct)).ToActionResult();

    [HttpGet("unlinked-users")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<List<UnlinkedUserDto>>> GetUnlinkedUsers(CancellationToken ct) =>
        (await teacherService.GetUnlinkedUsersAsync(ct)).ToActionResult();

    [HttpPut("{id:guid}/link-account")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<TeacherProfileDto>> LinkAccount(Guid id, LinkAccountRequest request, CancellationToken ct) =>
        (await teacherService.LinkAccountAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}/link-account")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<TeacherProfileDto>> UnlinkAccount(Guid id, CancellationToken ct) =>
        (await teacherService.UnlinkAccountAsync(id, ct)).ToActionResult();

    /// <summary>Cấp tài khoản đăng nhập cho hồ sơ GV có sẵn (tên đăng nhập = Mã GV, mật khẩu mặc định/nhập).</summary>
    [HttpPost("{id:guid}/account")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<AccountProvisionResultDto>> ProvisionAccount(Guid id, ProvisionAccountRequest request, CancellationToken ct) =>
        (await accountProvisioning.ProvisionTeacherAsync(id, new ProvisionAccountOptions(request.Password, request.LoginEmail), ct)).ToActionResult();

    /// <summary>Cấp tài khoản hàng loạt cho nhiều giáo viên chưa có tài khoản.</summary>
    [HttpPost("accounts/provision")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<BulkProvisionResultDto>> ProvisionAccounts(BulkProvisionRequest request, CancellationToken ct) =>
        Ok(await accountProvisioning.ProvisionTeachersAsync(request.Ids, new ProvisionAccountOptions(request.Password), ct));

    /// <summary>Đặt lại mật khẩu tài khoản giáo viên (trống ⇒ mật khẩu mặc định, bắt đổi lần đầu).</summary>
    [HttpPost("{id:guid}/account/reset-password")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> ResetPassword(Guid id, ResetPasswordRequest request, CancellationToken ct) =>
        (await accountProvisioning.ResetTeacherPasswordAsync(id, request.Password, ct)).ToActionResult();

    /// <summary>Khóa/mở khóa đăng nhập tài khoản giáo viên.</summary>
    [HttpPost("{id:guid}/account/lock")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> SetLocked(Guid id, SetAccountLockedRequest request, CancellationToken ct) =>
        (await accountProvisioning.SetTeacherLockedAsync(id, request.Locked, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await teacherService.DeleteAsync(id, ct)).ToActionResult();
}
