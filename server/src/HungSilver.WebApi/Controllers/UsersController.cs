using HungSilver.Application.Common.Models;
using HungSilver.Application.Users;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Policy = "AdminOnly")]
public class UsersController(IUserAdminService userAdminService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<UserListItemDto>>> GetUsers([FromQuery] PagedRequest request, CancellationToken ct) =>
        (await userAdminService.GetUsersAsync(request, ct)).ToActionResult();

    /// <summary>Admin tạo tài khoản Admin/Giáo viên.</summary>
    [HttpPost]
    public async Task<ActionResult<UserListItemDto>> Create(CreateUserRequest request, CancellationToken ct) =>
        (await userAdminService.CreateUserAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}/roles")]
    public async Task<ActionResult> AssignRoles(Guid id, AssignRolesRequest request, CancellationToken ct) =>
        (await userAdminService.AssignRolesAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> SoftDelete(Guid id, CancellationToken ct) =>
        (await userAdminService.SoftDeleteAsync(id, ct)).ToActionResult();

    [HttpPost("{id:guid}/restore")]
    public async Task<ActionResult> Restore(Guid id, CancellationToken ct) =>
        (await userAdminService.RestoreAsync(id, ct)).ToActionResult();
}
