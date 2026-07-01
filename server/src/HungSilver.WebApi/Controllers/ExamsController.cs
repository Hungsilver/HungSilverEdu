using HungSilver.Application.Abstractions;
using HungSilver.Application.Common.Models;
using HungSilver.Application.Exams;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

/// <summary>
/// Bộ đề trắc nghiệm: sinh từ tài liệu bằng AI, duyệt/sửa câu hỏi, phát hành vào bộ đề (mọi GV/Admin).
/// </summary>
[ApiController]
[Route("api/exams")]
[Authorize(Policy = "TeacherOrAdmin")]
public class ExamsController(
    IExamService service,
    IExamGenerationJobService generationJobs,
    IExamAssignmentService assignments,
    IExamReportService reports,
    ICurrentUser currentUser) : ControllerBase
{
    /// <summary>Bắt đầu job sinh đề từ 1 tài liệu (PDF/Word) bằng AI — trả jobId ngay để client polling, tránh timeout proxy.</summary>
    [HttpPost("generate/{materialId:guid}")]
    public async Task<ActionResult<ExamGenerationJobStartResult>> Generate(Guid materialId, GenerateExamRequest request, CancellationToken ct) =>
        (await generationJobs.StartAsync(materialId, request, UserId, ct)).ToActionResult();

    /// <summary>Trạng thái job sinh đề AI; khi Succeeded có ExamGenerationResult để mở đề nháp.</summary>
    [HttpGet("generation-jobs/{jobId:guid}")]
    public ActionResult<ExamGenerationJobDto> GenerationJob(Guid jobId) =>
        generationJobs.Get(jobId, UserId).ToActionResult();

    /// <summary>Danh sách đề theo Môn (kèm bộ lọc trạng thái) hoặc theo tài liệu — phân trang.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<ExamListItemDto>>> List(
        [FromQuery] Guid? subjectId, [FromQuery] Guid? materialId, [FromQuery] ExamStatus? status,
        [FromQuery] PagedRequest paging, CancellationToken ct)
    {
        if (materialId is not null)
            return (await service.GetPagedByMaterialAsync(materialId.Value, paging, ct)).ToActionResult();
        if (subjectId is not null)
            return (await service.GetPagedBySubjectAsync(subjectId.Value, status, paging, ct)).ToActionResult();
        return Result.Failure<PagedResult<ExamListItemDto>>(
            Error.Validation("Exam.QueryRequired", "Cần truyền subjectId hoặc materialId.")).ToActionResult();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ExamDetailDto>> Detail(Guid id, CancellationToken ct) =>
        (await service.GetDetailAsync(id, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ExamDetailDto>> Update(Guid id, UpdateExamRequest request, CancellationToken ct) =>
        (await service.UpdateExamAsync(id, request, ct)).ToActionResult();

    [HttpPost("{id:guid}/questions")]
    public async Task<ActionResult<ExamQuestionDto>> AddQuestion(Guid id, UpsertQuestionRequest request, CancellationToken ct) =>
        (await service.UpsertQuestionAsync(id, null, request, ct)).ToActionResult();

    [HttpPut("{id:guid}/questions/{questionId:guid}")]
    public async Task<ActionResult<ExamQuestionDto>> UpdateQuestion(Guid id, Guid questionId, UpsertQuestionRequest request, CancellationToken ct) =>
        (await service.UpsertQuestionAsync(id, questionId, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}/questions/{questionId:guid}")]
    public async Task<ActionResult> DeleteQuestion(Guid id, Guid questionId, CancellationToken ct) =>
        (await service.DeleteQuestionAsync(id, questionId, ct)).ToActionResult();

    [HttpPost("{id:guid}/publish")]
    public async Task<ActionResult> Publish(Guid id, CancellationToken ct) =>
        (await service.PublishAsync(id, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await service.DeleteAsync(id, ct)).ToActionResult();

    // ---- Giao đề cho lớp (Pha 2) ----

    /// <summary>Giao đề (đã phát hành) cho một lớp, hẹn giờ (trên lớp / về nhà).</summary>
    [HttpPost("{examId:guid}/assign")]
    public async Task<ActionResult<ExamAssignmentDto>> Assign(Guid examId, AssignExamRequest request, CancellationToken ct) =>
        (await assignments.AssignAsync(examId, request, ct)).ToActionResult();

    [HttpGet("{examId:guid}/assignments")]
    public async Task<ActionResult<List<ExamAssignmentDto>>> Assignments(Guid examId, CancellationToken ct) =>
        (await assignments.ListByExamAsync(examId, ct)).ToActionResult();

    [HttpPost("assignments/{assignmentId:guid}/close")]
    public async Task<ActionResult> CloseAssignment(Guid assignmentId, CancellationToken ct) =>
        (await assignments.CloseAsync(assignmentId, ct)).ToActionResult();

    /// <summary>Báo cáo trực quan một lượt giao đề (per-student, TB lớp, phân bố điểm, item analysis).</summary>
    [HttpGet("assignments/{assignmentId:guid}/report")]
    public async Task<ActionResult<ExamReportDto>> Report(Guid assignmentId, CancellationToken ct) =>
        (await reports.GetReportAsync(assignmentId, ct)).ToActionResult();

    private Guid UserId => currentUser.UserId ?? throw new InvalidOperationException("Thiếu user hiện tại.");
}
