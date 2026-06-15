using HungSilver.Application.Materials;
using HungSilver.Domain.Enums;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/materials")]
[Authorize(Policy = "TeacherOrAdmin")]
public class MaterialsController(IMaterialService materialService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<MaterialDto>>> GetByClass([FromQuery] Guid classId, CancellationToken ct) =>
        (await materialService.GetByClassAsync(classId, ct)).ToActionResult();

    /// <summary>Thư viện học liệu chung (không gắn lớp), lọc theo danh mục/loại.</summary>
    [HttpGet("library")]
    public async Task<ActionResult<List<MaterialDto>>> GetLibrary(
        [FromQuery] Guid? categoryId, [FromQuery] MaterialType? type, CancellationToken ct) =>
        (await materialService.GetLibraryAsync(categoryId, type, ct)).ToActionResult();

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
