using HungSilver.Application.Accounts;
using HungSilver.Application.Common.Models;
using HungSilver.Application.Users;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/users")]
// Toàn bộ quản trị tài khoản là AdminOnly — trước đây GET mở cho cả Giáo viên, tức GV xem được
// tên đăng nhập/email/họ tên của MỌI tài khoản trong hệ thống.
[Authorize(Policy = "AdminOnly")]
public class UsersController(IUserAdminService userAdminService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<UserListItemDto>>> GetUsers([FromQuery] PagedRequest request, CancellationToken ct) =>
        (await userAdminService.GetUsersAsync(request, ct)).ToActionResult();

    /// <summary>Admin tạo tài khoản Admin/Giáo viên.</summary>
    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<UserListItemDto>> Create(CreateUserRequest request, CancellationToken ct) =>
        (await userAdminService.CreateUserAsync(request, ct)).ToActionResult();

    /// <summary>Admin sửa thông tin cơ bản (tên đăng nhập/email/họ tên/SĐT) của tài khoản.</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<UserListItemDto>> Update(Guid id, UpdateUserRequest request, CancellationToken ct) =>
        (await userAdminService.UpdateUserAsync(id, request, ct)).ToActionResult();

    /// <summary>Admin đổi/đặt lại mật khẩu tài khoản (trống ⇒ mật khẩu mặc định) + thu hồi phiên đăng nhập.</summary>
    [HttpPost("{id:guid}/reset-password")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> ResetPassword(Guid id, AdminResetPasswordRequest request, CancellationToken ct) =>
        (await userAdminService.ResetPasswordAsync(id, request, ct)).ToActionResult();

    /// <summary>Admin khóa/mở khóa đăng nhập tài khoản.</summary>
    [HttpPost("{id:guid}/lock")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> SetLocked(Guid id, SetAccountLockedRequest request, CancellationToken ct) =>
        (await userAdminService.SetLockedAsync(id, request.Locked, ct)).ToActionResult();

    [HttpPut("{id:guid}/roles")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> AssignRoles(Guid id, AssignRolesRequest request, CancellationToken ct) =>
        (await userAdminService.AssignRolesAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> SoftDelete(Guid id, CancellationToken ct) =>
        (await userAdminService.SoftDeleteAsync(id, ct)).ToActionResult();

    [HttpPost("{id:guid}/restore")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Restore(Guid id, CancellationToken ct) =>
        (await userAdminService.RestoreAsync(id, ct)).ToActionResult();
}
