using HungSilver.Application.Abstractions;
using HungSilver.Application.AiCredentials;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

/// <summary>
/// Cấu hình API Key Google Gemini theo từng tài khoản (mọi vai trò đã đăng nhập).
/// Thao tác luôn trên user hiện tại — không cho sửa key của người khác.
/// </summary>
[ApiController]
[Route("api/ai-credential")]
[Authorize]
public class AiCredentialController(IAiCredentialService service, ICurrentUser currentUser) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<AiCredentialDto>> Get(CancellationToken ct) =>
        (await service.GetAsync(UserId, ct)).ToActionResult();

    [HttpPut]
    public async Task<ActionResult<AiCredentialDto>> Save(SaveAiCredentialRequest request, CancellationToken ct) =>
        (await service.SaveAsync(UserId, request, ct)).ToActionResult();

    [HttpPost("validate")]
    public async Task<ActionResult<ValidateAiKeyResult>> Validate(CancellationToken ct) =>
        (await service.ValidateAsync(UserId, ct)).ToActionResult();

    [HttpDelete]
    public async Task<ActionResult> Delete(CancellationToken ct) =>
        (await service.DeleteAsync(UserId, ct)).ToActionResult();

    private Guid UserId => currentUser.UserId ?? throw new InvalidOperationException("Thiếu user hiện tại.");
}
