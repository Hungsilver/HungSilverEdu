using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Application.Common.Models;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.Exams;

public interface IExamService
{
    /// <summary>Danh sách đề có lọc tổng hợp (môn/tài liệu/khối/trạng thái/tìm kiếm/đã giao) — dùng cho màn "Đề &amp; Bài tập".</summary>
    Task<Result<PagedResult<ExamListItemDto>>> GetPagedAsync(ExamListFilter filter, PagedRequest paging, CancellationToken ct = default);
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
    IRepository<ExamAssignment> assignments,
    IRepository<StoredFile> storedFiles,
    IClassAccessGuard accessGuard,
    IUserDirectory userDirectory,
    IUnitOfWork unitOfWork) : IExamService
{
    private static readonly Error NotFound = Error.NotFound("Exam.NotFound", "Không tìm thấy đề.");

    /// <summary>
    /// Đề đã giao cho lớp thì KHÓA cấu trúc: HS đang/đã làm bài trên nội dung này — sửa/xóa câu hay đổi
    /// thời gian sẽ làm lệch điểm và phá trang Xem lại (Start/Submit/Review đọc câu hỏi live, không snapshot).
    /// Muốn chỉnh: dùng "Nhân bản đề" rồi sửa trên bản sao.
    /// </summary>
    private Task<bool> HasAssignmentsAsync(Guid examId, CancellationToken ct) =>
        assignments.AnyAsync(a => a.ExamId == examId, ct);

    public async Task<Result<PagedResult<ExamListItemDto>>> GetPagedAsync(ExamListFilter filter, PagedRequest paging, CancellationToken ct = default)
    {
        var subjectId = filter.SubjectId;
        var materialId = filter.MaterialId;
        var gradeBand = string.IsNullOrWhiteSpace(filter.GradeBand) ? null : filter.GradeBand.Trim();
        var status = filter.Status;
        var term = string.IsNullOrWhiteSpace(filter.Search) ? null : filter.Search.Trim().ToLower();

        // "Đang giao" lọc theo lượt giao NHÌN THẤY ĐƯỢC (Admin: tất cả; GV: chỉ lớp mình phụ trách).
        List<Guid>? assignedExamIds = null;
        if (filter.AssignedOnly)
        {
            assignedExamIds = (await ScopedAssignmentsAsync(null, ct)).Select(a => a.ExamId).Distinct().ToList();
            if (assignedExamIds.Count == 0)
                return new PagedResult<ExamListItemDto> { Items = [], Page = paging.Page, PageSize = paging.PageSize, TotalCount = 0 };
        }

        var paged = await exams.GetPagedAsync(paging.Page, paging.PageSize,
            e => (subjectId == null || e.SubjectId == subjectId)
                 && (materialId == null || e.MaterialId == materialId)
                 && (gradeBand == null || e.GradeBand == gradeBand)
                 && (status == null || e.Status == status)
                 && (term == null || e.Title.ToLower().Contains(term))
                 && (assignedExamIds == null || assignedExamIds.Contains(e.Id)),
            ct: ct);

        return await ToListAsync(paged, ct);
    }

    /// <summary>
    /// Lượt giao trong phạm vi người dùng: Admin thấy tất cả, GV chỉ thấy lượt giao của lớp mình phụ trách.
    /// <paramref name="examIds"/> null = lấy toàn bộ (dùng cho bộ lọc "đang giao").
    /// Lưu ý: KHÔNG dùng cho <see cref="HasAssignmentsAsync"/> — khóa cấu trúc đề phải xét mọi lượt giao.
    /// </summary>
    private async Task<List<ExamAssignment>> ScopedAssignmentsAsync(List<Guid>? examIds, CancellationToken ct)
    {
        if (examIds is { Count: 0 }) return [];

        var list = examIds is null
            ? await assignments.FindAsync(a => true, ct)
            : await assignments.FindAsync(a => examIds.Contains(a.ExamId), ct);

        var scopeId = await accessGuard.GetTeacherScopeIdAsync(ct);
        if (scopeId is null) return [.. list]; // Admin

        var owned = await accessGuard.GetOwnedClassIdsAsync(ct);
        return list.Where(a => owned.Contains(a.ClassId)).ToList();
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

        var newDuration = request.DurationMinutes > 0 ? request.DurationMinutes : 60;
        if (newDuration != exam.DurationMinutes && await HasAssignmentsAsync(examId, ct))
            return Result.Failure<ExamDetailDto>(Error.Validation("Exam.AssignedDuration",
                "Đề đã được giao cho lớp — không đổi được thời gian làm bài. Hãy dùng \"Nhân bản đề\" để chỉnh trên bản sao."));

        exam.Title = request.Title.Trim();
        exam.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        exam.GradeBand = string.IsNullOrWhiteSpace(request.GradeBand) ? null : request.GradeBand.Trim();
        exam.DurationMinutes = newDuration;

        exams.Update(exam);
        await unitOfWork.SaveChangesAsync(ct);
        return await ToDetailAsync(exam, ct);
    }

    public async Task<Result<ExamQuestionDto>> UpsertQuestionAsync(Guid examId, Guid? questionId, UpsertQuestionRequest request, CancellationToken ct = default)
    {
        var exam = await exams.GetByIdAsync(examId, ct: ct);
        if (exam is null) return Result.Failure<ExamQuestionDto>(NotFound);
        if (await HasAssignmentsAsync(examId, ct))
            return Result.Failure<ExamQuestionDto>(Error.Validation("Exam.Assigned",
                "Đề đã được giao cho lớp — không thể thêm/sửa câu hỏi. Hãy dùng \"Nhân bản đề\" để chỉnh trên bản sao."));
        if (string.IsNullOrWhiteSpace(request.Stem))
            return Result.Failure<ExamQuestionDto>(Error.Validation("Exam.StemRequired", "Nội dung câu hỏi không được trống."));

        var content = ExamQuestionFactory.Build(request.Type, request.Options, request.OptionsRight,
            request.AnswerKey, request.AnswerBlanks, request.WordBox, request.AnswerPairs);
        if (content.IsFailure) return Result.Failure<ExamQuestionDto>(content.Error);

        ExamQuestion question;
        List<ExamQuestion> all;
        if (questionId is null)
        {
            var existing = await questions.FindAsync(q => q.ExamId == examId, ct);
            question = new ExamQuestion
            {
                ExamId = examId,
                OrderNo = existing.Count == 0 ? 0 : existing.Max(q => q.OrderNo) + 1
            };
            await questions.AddAsync(question, ct);
            // Câu mới chưa lưu DB nên FindAsync không thấy — ghép tay vào cuối danh sách để chia điểm.
            all = [.. existing.OrderBy(q => q.OrderNo), question];
        }
        else
        {
            var found = await questions.GetByIdAsync(questionId.Value, ct: ct);
            if (found is null || found.ExamId != examId)
                return Result.Failure<ExamQuestionDto>(Error.NotFound("Exam.QuestionNotFound", "Không tìm thấy câu hỏi."));
            question = found;
            questions.Update(question);
            all = [.. (await questions.FindAsync(q => q.ExamId == examId, ct)).OrderBy(q => q.OrderNo)];
        }

        question.GroupId = request.GroupId == Guid.Empty ? null : request.GroupId;
        question.Type = request.Type;
        question.Stem = request.Stem.Trim();
        question.OptionsJson = content.Value.OptionsJson;
        question.AnswerJson = content.Value.AnswerJson;
        question.Explanation = string.IsNullOrWhiteSpace(request.Explanation) ? null : request.Explanation.Trim();

        // Điểm luôn do hệ thống chia đều trên tổng điểm đề (đồng bộ đề AI sinh) — soạn tay không nhập điểm.
        ExamPoints.Distribute(all, exam.TotalPoints);
        foreach (var q in all.Where(q => q.Id != question.Id)) questions.Update(q);

        await unitOfWork.SaveChangesAsync(ct);
        return ToQuestionDto(question);
    }

    public async Task<Result> DeleteQuestionAsync(Guid examId, Guid questionId, CancellationToken ct = default)
    {
        var exam = await exams.GetByIdAsync(examId, ct: ct);
        if (exam is null) return Result.Failure(NotFound);
        if (await HasAssignmentsAsync(examId, ct))
            return Result.Failure(Error.Validation("Exam.Assigned",
                "Đề đã được giao cho lớp — không thể xóa câu hỏi. Hãy dùng \"Nhân bản đề\" để chỉnh trên bản sao."));
        var question = await questions.GetByIdAsync(questionId, ct: ct);
        if (question is null || question.ExamId != examId)
            return Result.Failure(Error.NotFound("Exam.QuestionNotFound", "Không tìm thấy câu hỏi."));

        questions.SoftDelete(question);

        // Chia lại điểm cho các câu còn lại — tổng đề luôn đúng bằng TotalPoints.
        var remaining = (await questions.FindAsync(q => q.ExamId == examId, ct))
            .Where(q => q.Id != questionId).OrderBy(q => q.OrderNo).ToList();
        ExamPoints.Distribute(remaining, exam.TotalPoints);
        foreach (var q in remaining) questions.Update(q);

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
        if (await HasAssignmentsAsync(examId, ct))
            return Result.Failure(Error.Validation("Exam.AssignedDelete",
                "Đề đã được giao cho lớp — xóa đề sẽ làm mất trang xem lại bài của học viên. Hãy đóng lượt giao thay vì xóa."));

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
        var creatorNames = await LoadCreatorNamesAsync(paged.Items, ct);
        var assignCounts = (await ScopedAssignmentsAsync(ids, ct))
            .GroupBy(a => a.ExamId).ToDictionary(g => g.Key, g => g.Count());
        var materialTitles = await LoadMaterialTitlesAsync(paged.Items, ct);

        return new PagedResult<ExamListItemDto>
        {
            Items = paged.Items.Select(e => ToListItem(
                e,
                counts.GetValueOrDefault(e.Id),
                e.MaterialId is { } mid ? materialTitles.GetValueOrDefault(mid) : null,
                assignCounts.GetValueOrDefault(e.Id),
                CreatorName(e, creatorNames))).ToList(),
            Page = paged.Page,
            PageSize = paged.PageSize,
            TotalCount = paged.TotalCount
        };
    }

    /// <summary>Tên tài liệu nguồn (live) cho danh sách đề — tài liệu đã xóa mềm sẽ không có tên.</summary>
    private async Task<Dictionary<Guid, string>> LoadMaterialTitlesAsync(IEnumerable<Exam> items, CancellationToken ct)
    {
        var ids = items.Where(e => e.MaterialId.HasValue).Select(e => e.MaterialId!.Value).Distinct().ToList();
        if (ids.Count == 0) return [];
        var found = await materials.FindAsync(m => ids.Contains(m.Id), ct);
        return found.ToDictionary(m => m.Id, m => m.Title);
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

        // Ưu tiên file snapshot trên đề (đề mới); fallback tra tài liệu cho đề cũ trước migration.
        string? sourceFileUrl = null;
        string? sourceFilePreviewUrl = null;
        var material = exam.MaterialId is { } mid ? await materials.GetByIdAsync(mid, ct: ct) : null;
        var materialFileId = material?.Source == MaterialSource.ServerFile ? material.StoredFileId : null;

        var fileId = exam.SourceStoredFileId ?? materialFileId;
        if (fileId is not null)
        {
            sourceFileUrl = $"/api/files/{fileId}";
            sourceFilePreviewUrl = $"/api/files/{fileId}/preview";
        }

        // AI đọc file KHÁC file của tài liệu (chọn tài liệu khác trong bộ / tải file câu hỏi riêng)
        // ⇒ nêu rõ tên file đó để GV không tưởng đề sinh từ chính bài học đang đứng.
        string? questionSourceName = null;
        if (fileId is not null && fileId != materialFileId)
            questionSourceName = (await storedFiles.GetByIdAsync(fileId.Value, ct: ct))?.FileName;

        var creatorNames = await LoadCreatorNamesAsync([exam], ct);

        return new ExamDetailDto(exam.Id, exam.MaterialId, exam.SubjectId, exam.SubjectName, exam.Title, exam.Description,
            exam.GradeBand, exam.DurationMinutes, exam.TotalPoints, exam.Status, exam.Source, sourceFileUrl, sourceFilePreviewUrl,
            material?.Title, questionSourceName,
            grs, qs, CreatorName(exam, creatorNames), exam.CreatedAt);
    }

    private static ExamListItemDto ToListItem(Exam e, int questionCount, string? materialTitle, int assignmentCount, string? createdByName) =>
        new(e.Id, e.MaterialId, e.SubjectId, e.SubjectName, e.Title, e.GradeBand, e.DurationMinutes, e.TotalPoints,
            e.Status, e.Source, questionCount, materialTitle, assignmentCount, createdByName, e.CreatedAt);

    private async Task<Dictionary<Guid, string>> LoadCreatorNamesAsync(IEnumerable<Exam> items, CancellationToken ct)
    {
        var ids = items.Where(e => e.CreatedByUserId.HasValue).Select(e => e.CreatedByUserId!.Value).Distinct().ToList();
        return ids.Count == 0 ? [] : await userDirectory.GetDisplayNamesAsync(ids, ct);
    }

    private static string? CreatorName(Exam e, Dictionary<Guid, string> names) =>
        e.CreatedByUserId is { } id && names.TryGetValue(id, out var name) ? name : null;

    private static ExamQuestionDto ToQuestionDto(ExamQuestion q) =>
        new(q.Id, q.GroupId, q.OrderNo, q.SourceNumber, q.Type, q.Stem, q.OptionsJson, q.AnswerJson, q.Explanation, q.Points);
}
