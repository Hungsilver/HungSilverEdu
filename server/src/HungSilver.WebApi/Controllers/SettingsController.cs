using HungSilver.Application.Settings;
using HungSilver.Domain.Enums;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize(Policy = "TeacherOrAdmin")]
public class SettingsController(ISettingsService settingsService) : ControllerBase
{
    /// <summary>Giá trị cấu hình hiệu lực cho user hiện tại (kèm lớp tùy chọn).</summary>
    [HttpGet("effective")]
    public async Task<ActionResult<EffectiveSettingsDto>> GetEffective([FromQuery] Guid? classId, CancellationToken ct) =>
        (await settingsService.GetEffectiveAsync(classId, ct)).ToActionResult();

    /// <summary>Danh sách cấu hình thô của một scope (kiểm quyền theo scope).</summary>
    [HttpGet("scope/{scope}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<List<SettingDto>>> GetScope(SettingScope scope, [FromQuery] Guid? scopeId, CancellationToken ct) =>
        (await settingsService.GetScopeAsync(scope, scopeId, ct)).ToActionResult();

    [HttpPut]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<SettingDto>> Upsert(UpsertSettingRequest request, CancellationToken ct) =>
        (await settingsService.UpsertAsync(request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await settingsService.DeleteAsync(id, ct)).ToActionResult();
}
