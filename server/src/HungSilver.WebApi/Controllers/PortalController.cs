using HungSilver.Application.Portal;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/portal")]
[Authorize]
public class PortalController(IPortalService portalService) : ControllerBase
{
    /// <summary>Hồ sơ + tiến độ của chính học sinh đang đăng nhập.</summary>
    [HttpGet("me")]
    public async Task<ActionResult<PortalProfileDto>> Me(CancellationToken ct) =>
        (await portalService.GetMyProfileAsync(ct)).ToActionResult();
}
