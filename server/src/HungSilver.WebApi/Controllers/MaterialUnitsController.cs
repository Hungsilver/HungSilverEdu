using HungSilver.Application.Materials;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

/// <summary>Unit/Chương trong Bộ tài liệu (kiểu Sách Mềm) — Bộ → Unit → Tài liệu.</summary>
[ApiController]
[Route("api/material-units")]
[Authorize(Policy = "TeacherOrAdmin")]
public class MaterialUnitsController(IMaterialUnitService unitService) : ControllerBase
{
    /// <summary>Danh sách unit của một bộ, đã sort + đánh số hiển thị (Unit 1/2…, Review 1/2… đếm riêng).</summary>
    [HttpGet]
    public async Task<ActionResult<List<MaterialUnitDto>>> GetByFolder([FromQuery] Guid folderId, CancellationToken ct) =>
        (await unitService.GetByFolderAsync(folderId, ct)).ToActionResult();

    [HttpPost]
    public async Task<ActionResult<MaterialUnitDto>> Create(CreateMaterialUnitRequest request, CancellationToken ct) =>
        (await unitService.CreateAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<MaterialUnitDto>> Update(Guid id, UpdateMaterialUnitRequest request, CancellationToken ct) =>
        (await unitService.UpdateAsync(id, request, ct)).ToActionResult();

    /// <summary>Sắp xếp lại toàn bộ unit của một bộ trong 1 call; trả về danh sách đã đánh số lại.</summary>
    [HttpPut("reorder")]
    public async Task<ActionResult<List<MaterialUnitDto>>> Reorder(ReorderMaterialUnitsRequest request, CancellationToken ct) =>
        (await unitService.ReorderAsync(request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await unitService.DeleteAsync(id, ct)).ToActionResult();
}
