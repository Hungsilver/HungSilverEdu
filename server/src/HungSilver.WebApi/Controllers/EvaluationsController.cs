using HungSilver.Application.Evaluations;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Authorize(Policy = "TeacherOrAdmin")]
public class EvaluationsController(IEvaluationService evaluationService) : ControllerBase
{
    [HttpGet("api/evaluations")]
    public async Task<ActionResult<List<MonthlyEvaluationDto>>> GetByClassMonth(
        [FromQuery] Guid classId, [FromQuery] int year, [FromQuery] int month, CancellationToken ct) =>
        (await evaluationService.GetByClassMonthAsync(classId, year, month, ct)).ToActionResult();

    [HttpGet("api/evaluations/students/{studentId:guid}")]
    public async Task<ActionResult<List<MonthlyEvaluationDto>>> GetByStudent(Guid studentId, CancellationToken ct) =>
        (await evaluationService.GetByStudentAsync(studentId, ct)).ToActionResult();

    [HttpPut("api/evaluations")]
    public async Task<ActionResult<MonthlyEvaluationDto>> Upsert(UpsertEvaluationRequest request, CancellationToken ct) =>
        (await evaluationService.UpsertAsync(request, ct)).ToActionResult();

    [HttpDelete("api/evaluations/{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await evaluationService.DeleteAsync(id, ct)).ToActionResult();

    [HttpGet("api/leaderboard")]
    public async Task<ActionResult<LeaderboardDto>> GetLeaderboard([FromQuery] Guid? classId, CancellationToken ct) =>
        (await evaluationService.GetLeaderboardAsync(classId, ct)).ToActionResult();
}
