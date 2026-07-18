using HungSilver.Application.Materials;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

/// <summary>Bộ tài liệu (vd "Tiếng Anh 10") — gom tài liệu theo Môn trong Kho tài liệu.</summary>
[ApiController]
[Route("api/material-folders")]
[Authorize(Policy = "TeacherOrAdmin")]
public class MaterialFoldersController(IMaterialFolderService folderService) : ControllerBase
{
    /// <summary>Mức 1 "Tài liệu môn học": danh sách môn kèm số bộ + số tài liệu.</summary>
    [HttpGet("subjects-summary")]
    public async Task<ActionResult<List<MaterialSubjectSummaryDto>>> SubjectsSummary(CancellationToken ct) =>
        (await folderService.GetSubjectsSummaryAsync(ct)).ToActionResult();

    [HttpGet]
    public async Task<ActionResult<List<MaterialFolderDto>>> GetBySubject([FromQuery] Guid subjectId, CancellationToken ct) =>
        (await folderService.GetBySubjectAsync(subjectId, ct)).ToActionResult();

    /// <summary>Một bộ theo id — màn chi tiết bộ (deep-link/F5) nạp trực tiếp.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<MaterialFolderDto>> GetById(Guid id, CancellationToken ct) =>
        (await folderService.GetByIdAsync(id, ct)).ToActionResult();

    [HttpPost]
    public async Task<ActionResult<MaterialFolderDto>> Create(CreateMaterialFolderRequest request, CancellationToken ct) =>
        (await folderService.CreateAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<MaterialFolderDto>> Update(Guid id, UpdateMaterialFolderRequest request, CancellationToken ct) =>
        (await folderService.UpdateAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await folderService.DeleteAsync(id, ct)).ToActionResult();
}
