using HungSilver.Application.Materials;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/material-categories")]
[Authorize(Policy = "TeacherOrAdmin")]
public class MaterialCategoriesController(IMaterialCategoryService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<MaterialCategoryDto>>> GetAll(CancellationToken ct) =>
        (await service.GetAllAsync(ct)).ToActionResult();

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<MaterialCategoryDto>> Create(CreateMaterialCategoryRequest request, CancellationToken ct) =>
        (await service.CreateAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<MaterialCategoryDto>> Update(Guid id, UpdateMaterialCategoryRequest request, CancellationToken ct) =>
        (await service.UpdateAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await service.DeleteAsync(id, ct)).ToActionResult();
}
