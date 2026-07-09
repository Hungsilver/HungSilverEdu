using HungSilver.Application.Abstractions;
using HungSilver.Application.Common.Models;
using HungSilver.Application.Exams;
using HungSilver.Application.Files;
using HungSilver.Application.Materials;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

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
    IExamQuestionBankService questionBank,
    IMaterialService materialService,
    IFileService fileService,
    ICurrentUser currentUser) : ControllerBase
{
    private const long MaxUploadBytes = 25L * 1024 * 1024;
    private static readonly HashSet<string> GenerationFileExtensions =
        new(StringComparer.OrdinalIgnoreCase) { ".pdf", ".doc", ".docx", ".odt", ".rtf", ".txt" };

    // ---- Ngân hàng câu hỏi (route literal — không đụng nhóm {id:guid} nhờ ràng buộc :guid) ----

    /// <summary>Ngân hàng câu hỏi: mọi câu từ mọi đề, lọc Môn/Khối/Tài liệu/Đề/Loại câu/Trạng thái + search — phân trang.</summary>
    [HttpGet("questions")]
    public async Task<ActionResult<PagedResult<ExamQuestionBankItemDto>>> Questions([FromQuery] ExamQuestionBankFilter filter, CancellationToken ct) =>
        (await questionBank.GetPagedAsync(filter, ct)).ToActionResult();

    /// <summary>Toàn bộ id câu hỏi khớp bộ lọc (phục vụ "chọn tất cả" — cap 1000).</summary>
    [HttpGet("questions/ids")]
    public async Task<ActionResult<ExamQuestionIdsDto>> QuestionIds([FromQuery] ExamQuestionBankFilter filter, CancellationToken ct) =>
        (await questionBank.GetIdsAsync(filter, ct)).ToActionResult();

    /// <summary>Tạo đề thủ công (Draft) từ các câu hỏi đã chọn trong ngân hàng — copy câu + nhóm ngữ liệu.</summary>
    [HttpPost("from-questions")]
    public async Task<ActionResult<CreateExamFromQuestionsResult>> CreateFromQuestions(CreateExamFromQuestionsRequest request, CancellationToken ct) =>
        (await questionBank.CreateExamFromQuestionsAsync(request, UserId, ct)).ToActionResult();

    /// <summary>Nhân bản nguyên trạng một đề thành đề Draft mới (chỉnh trên bản sao khi đề gốc đã giao).</summary>
    [HttpPost("{id:guid}/duplicate")]
    public async Task<ActionResult<CreateExamFromQuestionsResult>> Duplicate(Guid id, CancellationToken ct) =>
        (await questionBank.DuplicateExamAsync(id, UserId, ct)).ToActionResult();

    /// <summary>Bắt đầu job sinh đề từ 1 tài liệu (PDF/Word) bằng AI — trả jobId ngay để client polling, tránh timeout proxy.</summary>
    [HttpPost("generate/{materialId:guid}")]
    public async Task<ActionResult<ExamGenerationJobStartResult>> Generate(Guid materialId, GenerateExamRequest request, CancellationToken ct) =>
        (await generationJobs.StartAsync(materialId, request, UserId, ct)).ToActionResult();

    /// <summary>
    /// Upload một file đề mới, tạo tài liệu ngang hàng với tài liệu nguồn rồi bắt đầu job sinh đề AI từ file vừa upload.
    /// </summary>
    [HttpPost("generate-upload/{sourceMaterialId:guid}")]
    [RequestSizeLimit(MaxUploadBytes)]
    [EnableRateLimiting("upload")]
    public async Task<ActionResult<ExamGenerationJobStartResult>> GenerateFromUpload(
        Guid sourceMaterialId,
        [FromForm] GenerateExamUploadForm request,
        CancellationToken ct)
    {
        if (request.File is null || request.File.Length == 0)
            return Error.Validation("Files.Empty", "Chưa chọn file.").ToProblemResult();

        var materialTitle = request.MaterialTitle?.Trim();
        if (string.IsNullOrWhiteSpace(materialTitle))
            return Error.Validation("ExamUpload.MaterialTitleRequired", "Nhập tên tài liệu mới.").ToProblemResult();

        var ext = Path.GetExtension(request.File.FileName ?? string.Empty);
        if (!GenerationFileExtensions.Contains(ext))
            return Error.Validation("ExamUpload.UnsupportedFile",
                "Chỉ hỗ trợ file PDF/Word/Text để tạo đề.").ToProblemResult();

        var source = await materialService.GetByIdAsync(sourceMaterialId, ct);
        if (source.IsFailure)
            return source.Error.ToProblemResult();

        StoredFileDto uploaded;
        await using (var stream = request.File.OpenReadStream())
        {
            var upload = await fileService.UploadAsync(
                stream,
                request.File.FileName!,
                string.IsNullOrWhiteSpace(request.File.ContentType) ? "application/octet-stream" : request.File.ContentType,
                request.File.Length,
                ct: ct);
            if (upload.IsFailure)
                return upload.Error.ToProblemResult();
            uploaded = upload.Value;
        }

        var s = source.Value;
        var created = await materialService.CreateAsync(new CreateMaterialRequest(
            s.FolderId is null ? s.CategoryId : null,
            s.FolderId is null ? s.SubjectId : null,
            s.FolderId is null ? s.GradeBand : null,
            materialTitle,
            MaterialSource.ServerFile,
            null,
            uploaded.Id,
            null,
            null,
            s.FolderId), ct);
        if (created.IsFailure)
            return created.Error.ToProblemResult();

        var genRequest = new GenerateExamRequest(
            request.Mode,
            string.IsNullOrWhiteSpace(request.ExamTitle) ? null : request.ExamTitle.Trim(),
            request.DurationMinutes,
            request.MaxQuestions,
            string.IsNullOrWhiteSpace(request.Difficulty) ? null : request.Difficulty.Trim(),
            string.IsNullOrWhiteSpace(request.Instructions) ? null : request.Instructions.Trim(),
            request.Verify);

        return (await generationJobs.StartAsync(created.Value.Id, genRequest, UserId, ct)).ToActionResult();
    }

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

    /// <summary>Các lượt giao đề gắn với một buổi học (section Bài tập trong màn hình buổi học).</summary>
    [HttpGet("assignments/by-session/{sessionId:guid}")]
    public async Task<ActionResult<List<ExamAssignmentDto>>> AssignmentsBySession(Guid sessionId, CancellationToken ct) =>
        (await assignments.ListBySessionAsync(sessionId, ct)).ToActionResult();

    [HttpPost("assignments/{assignmentId:guid}/close")]
    public async Task<ActionResult> CloseAssignment(Guid assignmentId, CancellationToken ct) =>
        (await assignments.CloseAsync(assignmentId, ct)).ToActionResult();

    /// <summary>Báo cáo trực quan một lượt giao đề (per-student, TB lớp, phân bố điểm, item analysis).</summary>
    [HttpGet("assignments/{assignmentId:guid}/report")]
    public async Task<ActionResult<ExamReportDto>> Report(Guid assignmentId, CancellationToken ct) =>
        (await reports.GetReportAsync(assignmentId, ct)).ToActionResult();

    /// <summary>GV xem bài làm một học viên đã nộp (đáp án + bài làm + điểm từng câu).</summary>
    [HttpGet("attempts/{attemptId:guid}/review")]
    public async Task<ActionResult<TeacherAttemptReviewDto>> AttemptReview(Guid attemptId, CancellationToken ct) =>
        (await reports.GetAttemptReviewAsync(attemptId, ct)).ToActionResult();

    private Guid UserId => currentUser.UserId ?? throw new InvalidOperationException("Thiếu user hiện tại.");
}

public sealed class GenerateExamUploadForm
{
    public IFormFile? File { get; set; }
    public string? MaterialTitle { get; set; }
    public ExamGenerationMode Mode { get; set; } = ExamGenerationMode.Extract;
    public string? ExamTitle { get; set; }
    public int? DurationMinutes { get; set; }
    public int? MaxQuestions { get; set; }
    public string? Difficulty { get; set; }
    public string? Instructions { get; set; }
    public bool Verify { get; set; } = true;
}
