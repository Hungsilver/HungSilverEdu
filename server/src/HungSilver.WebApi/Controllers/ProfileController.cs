using System.Security.Claims;
using HungSilver.Application.Account;
using HungSilver.Application.Auth;
using HungSilver.Domain.Common.Results;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/profile")]
[Authorize]
public class ProfileController(IProfileService profileService) : ControllerBase
{
    /// <summary>Upload ảnh đại diện của chính người dùng đang đăng nhập.</summary>
    [HttpPost("avatar")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<UserDto>> UploadAvatar(IFormFile file, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Error.Unauthorized("Auth.InvalidToken", "Token không hợp lệ.").ToProblemResult();

        if (file is null || file.Length == 0)
            return BadRequest(new ProblemDetails { Title = "Files.Empty", Detail = "Chưa chọn ảnh." });

        await using var stream = file.OpenReadStream();
        var result = await profileService.UpdateAvatarAsync(userId, stream, file.FileName, file.ContentType, file.Length, ct);
        return result.ToActionResult();
    }

    /// <summary>Người dùng tự đổi mật khẩu của chính mình.</summary>
    [HttpPut("password")]
    public async Task<ActionResult> ChangePassword(ChangeOwnPasswordRequest request, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Error.Unauthorized("Auth.InvalidToken", "Token không hợp lệ.").ToProblemResult();

        return (await profileService.ChangePasswordAsync(userId, request, ct)).ToActionResult();
    }

    private bool TryGetUserId(out Guid userId) =>
        Guid.TryParse(User.FindFirstValue("sub"), out userId);
}
