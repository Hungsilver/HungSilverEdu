using HungSilver.Application.Grades;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/grades")]
[Authorize(Policy = "TeacherOrAdmin")]
public class GradesController(IGradeService gradeService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<GradeDto>>> GetAll(
        [FromQuery] bool includeInactive = false, CancellationToken ct = default) =>
        (await gradeService.GetAllAsync(includeInactive, ct)).ToActionResult();

    // Ghi danh mục dùng chung là cấu hình trung tâm — chỉ Admin (GV chỉ đọc để lọc/hiển thị).
    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<GradeDto>> Create(CreateGradeRequest request, CancellationToken ct) =>
        (await gradeService.CreateAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<GradeDto>> Update(Guid id, UpdateGradeRequest request, CancellationToken ct) =>
        (await gradeService.UpdateAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await gradeService.DeleteAsync(id, ct)).ToActionResult();
}
