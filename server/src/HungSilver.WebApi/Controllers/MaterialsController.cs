using HungSilver.Application.Common.Models;
using HungSilver.Application.Materials;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/materials")]
[Authorize(Policy = "TeacherOrAdmin")]
public class MaterialsController(IMaterialService materialService) : ControllerBase
{
    /// <summary>Danh sách tất cả tài liệu (phân trang) — lọc theo môn/loại/khối + search Mã/Tên.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<MaterialDto>>> GetPaged(
        [FromQuery] Guid? subjectId, [FromQuery] Guid? categoryId, [FromQuery] string? gradeBand,
        [FromQuery] PagedRequest paging, CancellationToken ct) =>
        (await materialService.GetPagedAsync(subjectId, categoryId, gradeBand, paging, ct)).ToActionResult();

    [HttpPost]
    public async Task<ActionResult<MaterialDto>> Create(CreateMaterialRequest request, CancellationToken ct) =>
        (await materialService.CreateAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<MaterialDto>> Update(Guid id, UpdateMaterialRequest request, CancellationToken ct) =>
        (await materialService.UpdateAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await materialService.DeleteAsync(id, ct)).ToActionResult();
}
