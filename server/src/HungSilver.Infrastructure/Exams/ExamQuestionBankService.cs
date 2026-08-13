using HungSilver.Application.Abstractions;
using HungSilver.Application.Common.Models;
using HungSilver.Application.Exams;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Exams;

/// <summary>
/// Ngân hàng câu hỏi = VIEW join ExamQuestion × Exam × LearningMaterial (không bảng mới, không migration).
/// Tạo đề từ câu đã chọn / nhân bản đề = COPY câu + nhóm ngữ liệu sang Exam mới (Draft) — đề nguồn
/// và các lượt làm bài cũ không bị ảnh hưởng.
/// </summary>
public sealed class ExamQuestionBankService(AppDbContext context, IUnitOfWork unitOfWork) : IExamQuestionBankService
{
    private const int MaxIds = 1000;      // trần "chọn tất cả"
    private const int MaxQuestions = 500; // trần số câu 1 đề tạo từ ngân hàng

    public async Task<Result<PagedResult<ExamQuestionBankItemDto>>> GetPagedAsync(ExamQuestionBankFilter filter, CancellationToken ct = default)
    {
        var query = BuildQuery(filter);
        var total = await query.CountAsync(ct);
        var rows = await query
            .Skip((filter.Page - 1) * filter.PageSize).Take(filter.PageSize)
            .Select(x => new ExamQuestionBankItemDto(
                x.Question.Id, x.Question.GroupId, x.Question.OrderNo, x.Question.Type, x.Question.Stem,
                x.Question.OptionsJson, x.Question.AnswerJson, x.Question.Explanation, x.Question.Points,
                x.Exam.Id, x.Exam.Title, x.Exam.Status,
                x.Exam.MaterialId, x.Material == null ? null : x.Material.Code, x.Material == null ? null : x.Material.Title,
                x.Exam.SubjectId ?? (x.Material == null ? null : x.Material.SubjectId),
                x.Exam.SubjectName ?? (x.Material == null ? null : x.Material.SubjectName),
                x.Exam.GradeBand ?? (x.Material == null ? null : x.Material.GradeBand),
                x.Question.CreatedAt))
            .ToListAsync(ct);

        return new PagedResult<ExamQuestionBankItemDto>
        {
            Items = rows,
            Page = filter.Page,
            PageSize = filter.PageSize,
            TotalCount = total
        };
    }

    public async Task<Result<ExamQuestionIdsDto>> GetIdsAsync(ExamQuestionBankFilter filter, CancellationToken ct = default)
    {
        var query = BuildQuery(filter);
        var total = await query.CountAsync(ct);
        var ids = await query.Select(x => x.Question.Id).Take(MaxIds).ToListAsync(ct);
        return new ExamQuestionIdsDto(ids, total, total > MaxIds);
    }

    public async Task<Result<CreateExamFromQuestionsResult>> CreateExamFromQuestionsAsync(
        CreateExamFromQuestionsRequest request, Guid? userId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return Result.Failure<CreateExamFromQuestionsResult>(Error.Validation("ExamBank.TitleRequired", "Tên đề không được trống."));

        // Dedupe giữ thứ tự chọn — thứ tự id = thứ tự câu trong đề mới.
        var ids = (request.QuestionIds ?? []).Where(id => id != Guid.Empty).Distinct().ToList();
        if (ids.Count == 0)
            return Result.Failure<CreateExamFromQuestionsResult>(Error.Validation("ExamBank.NoQuestions", "Chưa chọn câu hỏi nào."));
        if (ids.Count > MaxQuestions)
            return Result.Failure<CreateExamFromQuestionsResult>(Error.Validation("ExamBank.TooMany", $"Tối đa {MaxQuestions} câu cho một đề."));

        var foundById = (await context.ExamQuestions.AsNoTracking()
            .Where(q => ids.Contains(q.Id)).ToListAsync(ct)).ToDictionary(q => q.Id);
        var missing = ids.Count(id => !foundById.ContainsKey(id));
        if (missing > 0)
            return Result.Failure<CreateExamFromQuestionsResult>(Error.Validation(
                "ExamBank.QuestionsMissing", $"Có {missing} câu không còn tồn tại — hãy tải lại danh sách rồi chọn lại."));

        var source = ids.Select(id => foundById[id]).ToList();

        // Ngữ cảnh từ các đề nguồn: suy Môn khi không truyền (mọi đề nguồn cùng 1 môn), ngôn ngữ đề.
        var sourceExamIds = source.Select(q => q.ExamId).Distinct().ToList();
        var sourceExams = await context.Exams.AsNoTracking()
            .Where(e => sourceExamIds.Contains(e.Id)).ToListAsync(ct);

        Guid? subjectId;
        string? subjectName;
        if (request.SubjectId is { } sid && sid != Guid.Empty)
        {
            subjectId = sid;
            subjectName = (await context.Subjects.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sid, ct))?.Name
                ?? sourceExams.FirstOrDefault(e => e.SubjectId == sid)?.SubjectName;
        }
        else
        {
            var subjectIds = sourceExams.Where(e => e.SubjectId is not null).Select(e => e.SubjectId).Distinct().ToList();
            subjectId = subjectIds.Count == 1 ? subjectIds[0] : null;
            subjectName = subjectId is null ? null : sourceExams.First(e => e.SubjectId == subjectId).SubjectName;
        }

        var exam = new Exam
        {
            MaterialId = null,
            SubjectId = subjectId,
            SubjectName = subjectName,
            Title = request.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            GradeBand = string.IsNullOrWhiteSpace(request.GradeBand) ? null : request.GradeBand.Trim(),
            DurationMinutes = request.DurationMinutes > 0 ? request.DurationMinutes : 60,
            TotalPoints = 10m,
            Status = ExamStatus.Draft,
            Source = ExamGenSource.Manual,
            CreatedByUserId = userId
        };

        // Copy nhóm ngữ liệu (Passage/Instruction...) được câu tham chiếu — thứ tự theo lần xuất hiện
        // đầu trong danh sách câu đã chọn. Group gốc đã mất (xóa mềm lẻ) ⇒ câu copy với GroupId=null.
        var refGroupIds = source.Where(q => q.GroupId is not null).Select(q => q.GroupId!.Value).Distinct().ToList();
        var sourceGroups = refGroupIds.Count == 0
            ? []
            : await context.ExamQuestionGroups.AsNoTracking().Where(g => refGroupIds.Contains(g.Id)).ToListAsync(ct);
        var groupById = sourceGroups.ToDictionary(g => g.Id);

        var groupMap = new Dictionary<Guid, Guid>();
        var newGroups = new List<ExamQuestionGroup>();
        foreach (var q in source)
        {
            if (q.GroupId is not { } gid || groupMap.ContainsKey(gid) || !groupById.TryGetValue(gid, out var g)) continue;
            var copy = new ExamQuestionGroup
            {
                ExamId = exam.Id,
                OrderNo = newGroups.Count,
                Section = g.Section,
                ExerciseLabel = g.ExerciseLabel,
                Instruction = g.Instruction,
                Passage = g.Passage
            };
            newGroups.Add(copy);
            groupMap[gid] = copy.Id;
        }

        var newQuestions = source.Select((q, index) => new ExamQuestion
        {
            ExamId = exam.Id,
            GroupId = q.GroupId is { } gid && groupMap.TryGetValue(gid, out var ng) ? ng : null,
            OrderNo = index,
            SourceNumber = q.SourceNumber,
            Type = q.Type,
            Stem = q.Stem,
            OptionsJson = q.OptionsJson,
            AnswerJson = q.AnswerJson,
            Explanation = q.Explanation
        }).ToList();
        ExamPoints.Distribute(newQuestions, exam.TotalPoints);

        context.Exams.Add(exam);
        context.ExamQuestionGroups.AddRange(newGroups);
        context.ExamQuestions.AddRange(newQuestions);
        await unitOfWork.SaveChangesAsync(ct);

        return new CreateExamFromQuestionsResult(exam.Id, newQuestions.Count);
    }

    public async Task<Result<CreateExamFromQuestionsResult>> DuplicateExamAsync(Guid examId, Guid? userId, CancellationToken ct = default)
    {
        var source = await context.Exams.AsNoTracking().FirstOrDefaultAsync(e => e.Id == examId, ct);
        if (source is null)
            return Result.Failure<CreateExamFromQuestionsResult>(Error.NotFound("Exam.NotFound", "Không tìm thấy đề."));

        var copy = new Exam
        {
            MaterialId = source.MaterialId,
            SourceStoredFileId = source.SourceStoredFileId,
            SubjectId = source.SubjectId,
            SubjectName = source.SubjectName,
            Title = source.Title + " (bản sao)",
            Description = source.Description,
            GradeBand = source.GradeBand,
            DurationMinutes = source.DurationMinutes,
            TotalPoints = source.TotalPoints,
            Status = ExamStatus.Draft,
            Source = source.Source,
            CreatedByUserId = userId
        };

        // Nhân bản trung thực: copy TOÀN BỘ nhóm theo đề (kể cả nhóm chưa có câu) + toàn bộ câu, giữ điểm/thứ tự.
        var groups = await context.ExamQuestionGroups.AsNoTracking().Where(g => g.ExamId == examId).ToListAsync(ct);
        var groupMap = new Dictionary<Guid, Guid>();
        var newGroups = groups.Select(g =>
        {
            var ng = new ExamQuestionGroup
            {
                ExamId = copy.Id,
                OrderNo = g.OrderNo,
                Section = g.Section,
                ExerciseLabel = g.ExerciseLabel,
                Instruction = g.Instruction,
                Passage = g.Passage
            };
            groupMap[g.Id] = ng.Id;
            return ng;
        }).ToList();

        var questions = await context.ExamQuestions.AsNoTracking().Where(q => q.ExamId == examId).ToListAsync(ct);
        var newQuestions = questions.Select(q => new ExamQuestion
        {
            ExamId = copy.Id,
            GroupId = q.GroupId is { } gid && groupMap.TryGetValue(gid, out var ng) ? ng : null,
            OrderNo = q.OrderNo,
            SourceNumber = q.SourceNumber,
            Type = q.Type,
            Stem = q.Stem,
            OptionsJson = q.OptionsJson,
            AnswerJson = q.AnswerJson,
            Explanation = q.Explanation,
            Points = q.Points
        }).ToList();

        context.Exams.Add(copy);
        context.ExamQuestionGroups.AddRange(newGroups);
        context.ExamQuestions.AddRange(newQuestions);
        await unitOfWork.SaveChangesAsync(ct);

        return new CreateExamFromQuestionsResult(copy.Id, newQuestions.Count);
    }

    // ----------------- Query nền dùng chung -----------------

    private sealed class BankRow
    {
        public ExamQuestion Question { get; init; } = null!;
        public Exam Exam { get; init; } = null!;
        public LearningMaterial? Material { get; init; }
    }

    /// <summary>
    /// Join câu × đề (inner — query filter soft-delete tự loại câu của đề đã xóa) × tài liệu (left —
    /// chịu được MaterialId null lẫn tài liệu đã xóa mềm). Sort cố định + ổn định để trang và
    /// "chọn tất cả" (GetIds) cùng một thứ tự.
    /// </summary>
    private IQueryable<BankRow> BuildQuery(ExamQuestionBankFilter filter)
    {
        var query =
            from q in context.ExamQuestions.AsNoTracking()
            join e in context.Exams.AsNoTracking() on q.ExamId equals e.Id
            join m0 in context.LearningMaterials.AsNoTracking() on e.MaterialId equals (Guid?)m0.Id into mj
            from m in mj.DefaultIfEmpty()
            select new BankRow { Question = q, Exam = e, Material = m };

        if (filter.ExamId is { } examId)
            query = query.Where(x => x.Exam.Id == examId);
        if (filter.MaterialId is { } materialId)
            query = query.Where(x => x.Exam.MaterialId == materialId);
        if (filter.SubjectId is { } subjectId)
            query = query.Where(x => (x.Exam.SubjectId ?? (x.Material == null ? null : x.Material.SubjectId)) == subjectId);
        if (!string.IsNullOrWhiteSpace(filter.GradeBand))
        {
            var band = filter.GradeBand.Trim();
            query = query.Where(x => (x.Exam.GradeBand ?? (x.Material == null ? null : x.Material.GradeBand)) == band);
        }
        if (filter.Type is { } type)
            query = query.Where(x => x.Question.Type == type);
        if (filter.ExamStatus is { } status)
            query = query.Where(x => x.Exam.Status == status);
        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var s = filter.Search.Trim().ToLower();
            query = query.Where(x => x.Question.Stem.ToLower().Contains(s)
                || x.Exam.Title.ToLower().Contains(s)
                || (x.Material != null && (x.Material.Code.ToLower().Contains(s) || x.Material.Title.ToLower().Contains(s))));
        }

        return query
            .OrderByDescending(x => x.Exam.CreatedAt)
            .ThenBy(x => x.Question.ExamId)
            .ThenBy(x => x.Question.OrderNo);
    }
}
