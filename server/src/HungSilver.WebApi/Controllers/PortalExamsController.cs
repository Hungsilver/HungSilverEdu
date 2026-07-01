using HungSilver.Application.Exams;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

/// <summary>
/// Học viên làm đề được giao (role User trên FE; BE guard theo <c>Student.UserId</c> + enrollment trong service).
/// Đáp án/giải thích chỉ trả ở endpoint xem lại (sau khi nộp).
/// </summary>
[ApiController]
[Route("api/portal/exams")]
[Authorize]
public class PortalExamsController(IExamTakingService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<PortalExamDto>>> MyExams(CancellationToken ct) =>
        (await service.GetMyExamsAsync(ct)).ToActionResult();

    [HttpPost("{assignmentId:guid}/start")]
    public async Task<ActionResult<PortalAttemptDto>> Start(Guid assignmentId, CancellationToken ct) =>
        (await service.StartAsync(assignmentId, ct)).ToActionResult();

    [HttpPut("attempts/{attemptId:guid}/answer")]
    public async Task<ActionResult> SaveAnswer(Guid attemptId, SaveExamAnswerRequest request, CancellationToken ct) =>
        (await service.SaveAnswerAsync(attemptId, request, ct)).ToActionResult();

    [HttpPost("attempts/{attemptId:guid}/submit")]
    public async Task<ActionResult<ExamAttemptResultDto>> Submit(Guid attemptId, CancellationToken ct) =>
        (await service.SubmitAsync(attemptId, ct)).ToActionResult();

    [HttpGet("attempts/{attemptId:guid}/review")]
    public async Task<ActionResult<PortalReviewDto>> Review(Guid attemptId, CancellationToken ct) =>
        (await service.GetReviewAsync(attemptId, ct)).ToActionResult();
}
