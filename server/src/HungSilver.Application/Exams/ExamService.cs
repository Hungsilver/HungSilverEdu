using HungSilver.Application.Abstractions;
using HungSilver.Application.Common.Models;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.Exams;

public interface IExamService
{
    Task<Result<PagedResult<ExamListItemDto>>> GetPagedBySubjectAsync(Guid subjectId, ExamStatus? status, PagedRequest paging, CancellationToken ct = default);
    Task<Result<PagedResult<ExamListItemDto>>> GetPagedByMaterialAsync(Guid materialId, PagedRequest paging, CancellationToken ct = default);
    Task<Result<ExamDetailDto>> GetDetailAsync(Guid examId, CancellationToken ct = default);
    Task<Result<ExamDetailDto>> UpdateExamAsync(Guid examId, UpdateExamRequest request, CancellationToken ct = default);
    Task<Result<ExamQuestionDto>> UpsertQuestionAsync(Guid examId, Guid? questionId, UpsertQuestionRequest request, CancellationToken ct = default);
    Task<Result> DeleteQuestionAsync(Guid examId, Guid questionId, CancellationToken ct = default);
    Task<Result> PublishAsync(Guid examId, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid examId, CancellationToken ct = default);
}

/// <summary>CRUD + duyệt/publish đề. Không gọi AI (đó là <see cref="IExamGenerationService"/>).</summary>
public sealed class ExamService(
    IRepository<Exam> exams,
    IRepository<ExamQuestionGroup> groups,
    IRepository<ExamQuestion> questions,
    IRepository<LearningMaterial> materials,
    IUnitOfWork unitOfWork) : IExamService
{
    private static readonly Error NotFound = Error.NotFound("Exam.NotFound", "Không tìm thấy đề.");

    public async Task<Result<PagedResult<ExamListItemDto>>> GetPagedBySubjectAsync(Guid subjectId, ExamStatus? status, PagedRequest paging, CancellationToken ct = default)
    {
        var paged = await exams.GetPagedAsync(paging.Page, paging.PageSize,
            e => e.SubjectId == subjectId && (status == null || e.Status == status), ct: ct);
        return await ToListAsync(paged, ct);
    }

    public async Task<Result<PagedResult<ExamListItemDto>>> GetPagedByMaterialAsync(Guid materialId, PagedRequest paging, CancellationToken ct = default)
    {
        var paged = await exams.GetPagedAsync(paging.Page, paging.PageSize, e => e.MaterialId == materialId, ct: ct);
        return await ToListAsync(paged, ct);
    }

    public async Task<Result<ExamDetailDto>> GetDetailAsync(Guid examId, CancellationToken ct = default)
    {
        var exam = await exams.GetByIdAsync(examId, ct: ct);
        if (exam is null) return Result.Failure<ExamDetailDto>(NotFound);
        return await ToDetailAsync(exam, ct);
    }

    public async Task<Result<ExamDetailDto>> UpdateExamAsync(Guid examId, UpdateExamRequest request, CancellationToken ct = default)
    {
        var exam = await exams.GetByIdAsync(examId, ct: ct);
        if (exam is null) return Result.Failure<ExamDetailDto>(NotFound);
        if (string.IsNullOrWhiteSpace(request.Title))
            return Result.Failure<ExamDetailDto>(Error.Validation("Exam.TitleRequired", "Tên đề không được trống."));

        exam.Title = request.Title.Trim();
        exam.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        exam.GradeBand = string.IsNullOrWhiteSpace(request.GradeBand) ? null : request.GradeBand.Trim();
        exam.DurationMinutes = request.DurationMinutes > 0 ? request.DurationMinutes : 60;

        exams.Update(exam);
        await unitOfWork.SaveChangesAsync(ct);
        return await ToDetailAsync(exam, ct);
    }

    public async Task<Result<ExamQuestionDto>> UpsertQuestionAsync(Guid examId, Guid? questionId, UpsertQuestionRequest request, CancellationToken ct = default)
    {
        var exam = await exams.GetByIdAsync(examId, ct: ct);
        if (exam is null) return Result.Failure<ExamQuestionDto>(NotFound);
        if (string.IsNullOrWhiteSpace(request.Stem))
            return Result.Failure<ExamQuestionDto>(Error.Validation("Exam.StemRequired", "Nội dung câu hỏi không được trống."));

        var content = ExamQuestionFactory.Build(request.Type, request.Options, request.OptionsRight,
            request.AnswerKey, request.AnswerBlanks, request.WordBox, request.AnswerPairs);
        if (content.IsFailure) return Result.Failure<ExamQuestionDto>(content.Error);

        ExamQuestion question;
        if (questionId is null)
        {
            var existing = await questions.FindAsync(q => q.ExamId == examId, ct);
            question = new ExamQuestion
            {
                ExamId = examId,
                OrderNo = existing.Count == 0 ? 0 : existing.Max(q => q.OrderNo) + 1
            };
            await questions.AddAsync(question, ct);
        }
        else
        {
            var found = await questions.GetByIdAsync(questionId.Value, ct: ct);
            if (found is null || found.ExamId != examId)
                return Result.Failure<ExamQuestionDto>(Error.NotFound("Exam.QuestionNotFound", "Không tìm thấy câu hỏi."));
            question = found;
            questions.Update(question);
        }

        question.GroupId = request.GroupId == Guid.Empty ? null : request.GroupId;
        question.Type = request.Type;
        question.Stem = request.Stem.Trim();
        question.OptionsJson = content.Value.OptionsJson;
        question.AnswerJson = content.Value.AnswerJson;
        question.Explanation = string.IsNullOrWhiteSpace(request.Explanation) ? null : request.Explanation.Trim();
        if (request.Points is > 0) question.Points = request.Points.Value;

        await unitOfWork.SaveChangesAsync(ct);
        return ToQuestionDto(question);
    }

    public async Task<Result> DeleteQuestionAsync(Guid examId, Guid questionId, CancellationToken ct = default)
    {
        var question = await questions.GetByIdAsync(questionId, ct: ct);
        if (question is null || question.ExamId != examId)
            return Result.Failure(Error.NotFound("Exam.QuestionNotFound", "Không tìm thấy câu hỏi."));

        questions.SoftDelete(question);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result> PublishAsync(Guid examId, CancellationToken ct = default)
    {
        var exam = await exams.GetByIdAsync(examId, ct: ct);
        if (exam is null) return Result.Failure(NotFound);

        var hasQuestions = await questions.AnyAsync(q => q.ExamId == examId, ct);
        if (!hasQuestions)
            return Result.Failure(Error.Validation("Exam.Empty", "Đề chưa có câu hỏi nào để phát hành."));

        exam.Status = ExamStatus.Published;
        exams.Update(exam);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result> DeleteAsync(Guid examId, CancellationToken ct = default)
    {
        var exam = await exams.GetByIdAsync(examId, ct: ct);
        if (exam is null) return Result.Failure(NotFound);

        foreach (var q in await questions.FindAsync(x => x.ExamId == examId, ct)) questions.SoftDelete(q);
        foreach (var g in await groups.FindAsync(x => x.ExamId == examId, ct)) groups.SoftDelete(g);
        exams.SoftDelete(exam);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }

    // ----------------- Mapping -----------------

    private async Task<PagedResult<ExamListItemDto>> ToListAsync(PagedResult<Exam> paged, CancellationToken ct)
    {
        var ids = paged.Items.Select(e => e.Id).ToList();
        var counts = await LoadQuestionCountsAsync(ids, ct);
        return new PagedResult<ExamListItemDto>
        {
            Items = paged.Items.Select(e => ToListItem(e, counts.GetValueOrDefault(e.Id))).ToList(),
            Page = paged.Page,
            PageSize = paged.PageSize,
            TotalCount = paged.TotalCount
        };
    }

    private async Task<Dictionary<Guid, int>> LoadQuestionCountsAsync(List<Guid> examIds, CancellationToken ct)
    {
        if (examIds.Count == 0) return [];
        var qs = await questions.FindAsync(q => examIds.Contains(q.ExamId), ct);
        return qs.GroupBy(q => q.ExamId).ToDictionary(g => g.Key, g => g.Count());
    }

    private async Task<ExamDetailDto> ToDetailAsync(Exam exam, CancellationToken ct)
    {
        var grs = (await groups.FindAsync(g => g.ExamId == exam.Id, ct)).OrderBy(g => g.OrderNo)
            .Select(g => new ExamGroupDto(g.Id, g.OrderNo, g.Section, g.ExerciseLabel, g.Instruction, g.Passage)).ToList();
        var qs = (await questions.FindAsync(q => q.ExamId == exam.Id, ct)).OrderBy(q => q.OrderNo)
            .Select(ToQuestionDto).ToList();

        string? sourceFileUrl = null;
        if (exam.MaterialId is not null)
        {
            var material = await materials.GetByIdAsync(exam.MaterialId.Value, ct: ct);
            if (material?.Source == MaterialSource.ServerFile && material.StoredFileId is not null)
                sourceFileUrl = $"/api/files/{material.StoredFileId}";
        }

        return new ExamDetailDto(exam.Id, exam.MaterialId, exam.SubjectId, exam.SubjectName, exam.Title, exam.Description,
            exam.GradeBand, exam.DurationMinutes, exam.TotalPoints, exam.Status, exam.Source, sourceFileUrl, grs, qs, exam.CreatedAt);
    }

    private static ExamListItemDto ToListItem(Exam e, int questionCount) =>
        new(e.Id, e.MaterialId, e.SubjectId, e.SubjectName, e.Title, e.GradeBand, e.DurationMinutes, e.TotalPoints,
            e.Status, e.Source, questionCount, e.CreatedAt);

    private static ExamQuestionDto ToQuestionDto(ExamQuestion q) =>
        new(q.Id, q.GroupId, q.OrderNo, q.SourceNumber, q.Type, q.Stem, q.OptionsJson, q.AnswerJson, q.Explanation, q.Points);
}
