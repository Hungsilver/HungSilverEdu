using HungSilver.Application.Assignments;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/assignments")]
[Authorize(Policy = "TeacherOrAdmin")]
public class AssignmentsController(IAssignmentService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<AssignmentDto>>> GetByClass([FromQuery] Guid classId, CancellationToken ct) =>
        (await service.GetByClassAsync(classId, ct)).ToActionResult();

    [HttpGet("by-session/{sessionId:guid}")]
    public async Task<ActionResult<List<AssignmentDto>>> GetBySession(Guid sessionId, CancellationToken ct) =>
        (await service.GetBySessionAsync(sessionId, ct)).ToActionResult();

    [HttpPost]
    public async Task<ActionResult<AssignmentDto>> Create(CreateAssignmentRequest request, CancellationToken ct) =>
        (await service.CreateAsync(request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await service.DeleteAsync(id, ct)).ToActionResult();

    [HttpGet("{id:guid}/submissions")]
    public async Task<ActionResult<List<SubmissionStatusDto>>> GetSubmissions(Guid id, CancellationToken ct) =>
        (await service.GetSubmissionsAsync(id, ct)).ToActionResult();

    [HttpPut("{id:guid}/submissions/{studentId:guid}")]
    public async Task<ActionResult> SetStatus(Guid id, Guid studentId, SetSubmissionStatusRequest request, CancellationToken ct) =>
        (await service.SetStatusAsync(id, studentId, request, ct)).ToActionResult();
}
