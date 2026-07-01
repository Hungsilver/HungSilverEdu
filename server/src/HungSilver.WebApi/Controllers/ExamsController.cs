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
    IExamGenerationService generation,
    ICurrentUser currentUser) : ControllerBase
{
    /// <summary>Sinh đề từ 1 tài liệu (PDF/Word) bằng AI — trả về đề nháp + cảnh báo kiểm chứng.</summary>
    [HttpPost("generate/{materialId:guid}")]
    public async Task<ActionResult<ExamGenerationResult>> Generate(Guid materialId, GenerateExamRequest request, CancellationToken ct) =>
        (await generation.GenerateFromMaterialAsync(materialId, request, UserId, ct)).ToActionResult();

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

    private Guid UserId => currentUser.UserId ?? throw new InvalidOperationException("Thiếu user hiện tại.");
}
