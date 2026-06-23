using HungSilver.Application.Subjects;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/subjects")]
[Authorize(Policy = "TeacherOrAdmin")]
public class SubjectsController(ISubjectService subjectService) : ControllerBase
{
    /// <summary>Danh sách môn học (mặc định chỉ môn đang bật). Đọc cho Teacher/Admin.</summary>
    [HttpGet]
    public async Task<ActionResult<List<SubjectDto>>> GetAll([FromQuery] bool includeInactive = false, CancellationToken ct = default) =>
        (await subjectService.GetAllAsync(includeInactive, ct)).ToActionResult();

    // Ghi danh mục dùng chung là cấu hình trung tâm — chỉ Admin (GV chỉ đọc để lọc/hiển thị).
    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<SubjectDto>> Create(CreateSubjectRequest request, CancellationToken ct) =>
        (await subjectService.CreateAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<SubjectDto>> Update(Guid id, UpdateSubjectRequest request, CancellationToken ct) =>
        (await subjectService.UpdateAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await subjectService.DeleteAsync(id, ct)).ToActionResult();
}
