using HungSilver.Application.Exams;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Exams;
using HungSilver.Infrastructure.Persistence;
using HungSilver.Infrastructure.Persistence.Interceptors;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>
/// Ngân hàng câu hỏi: view join câu × đề × tài liệu (lọc/search/sort), tạo đề từ câu đã chọn
/// (copy câu + nhóm ngữ liệu, chia điểm /10), nhân bản đề nguyên trạng.
/// </summary>
public sealed class ExamQuestionBankServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;

    public ExamQuestionBankServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection).AddInterceptors(new AuditSaveChangesInterceptor()).Options;
        _context = new AppDbContext(options);
        _context.Database.EnsureCreated();
    }

    public void Dispose() { _context.Dispose(); _connection.Dispose(); }

    private ExamQuestionBankService Bank() => new(_context, new UnitOfWork(_context));

    // ---- Seed helpers ----

    private LearningMaterial SeedMaterial(string code = "TL0001", string title = "Unit 3 Reading", Guid? subjectId = null)
    {
        var m = new LearningMaterial { Code = code, Title = title, SubjectId = subjectId, SubjectName = "Tiếng Anh", GradeBand = "5" };
        _context.LearningMaterials.Add(m);
        _context.SaveChanges();
        return m;
    }

    private Exam SeedExam(string title, Guid? materialId = null, Guid? subjectId = null, string? gradeBand = null,
        ExamStatus status = ExamStatus.Draft)
    {
        var e = new Exam
        {
            Title = title, MaterialId = materialId, SubjectId = subjectId, SubjectName = subjectId is null ? null : "Tiếng Anh",
            GradeBand = gradeBand, Status = status, TotalPoints = 10m
        };
        _context.Exams.Add(e);
        _context.SaveChanges();
        return e;
    }

    private ExamQuestion SeedQuestion(Guid examId, int order, string stem, Guid? groupId = null,
        ExamQuestionType type = ExamQuestionType.SingleChoice)
    {
        var q = new ExamQuestion
        {
            ExamId = examId, GroupId = groupId, OrderNo = order, Type = type, Stem = stem,
            OptionsJson = "[{\"key\":\"A\",\"text\":\"a\"},{\"key\":\"B\",\"text\":\"b\"}]",
            AnswerJson = "{\"key\":\"A\"}", Points = 1m
        };
        _context.ExamQuestions.Add(q);
        _context.SaveChanges();
        return q;
    }

    private ExamQuestionGroup SeedGroup(Guid examId, string? passage = "Đoạn văn X")
    {
        var g = new ExamQuestionGroup { ExamId = examId, OrderNo = 0, ExerciseLabel = "Exercise 1", Passage = passage };
        _context.ExamQuestionGroups.Add(g);
        _context.SaveChanges();
        return g;
    }

    // ---- GetPaged / GetIds ----

    [Fact]
    public async Task GetPaged_JoinsExamAndMaterial_FiltersByTypeAndStatusAndSearch()
    {
        var subjectId = Guid.NewGuid();
        var material = SeedMaterial();
        var published = SeedExam("Đề A", material.Id, subjectId, "5", ExamStatus.Published);
        var draft = SeedExam("Đề B", null, subjectId);
        SeedQuestion(published.Id, 0, "What is mental health?");
        SeedQuestion(published.Id, 1, "True or false?", type: ExamQuestionType.TrueFalse);
        SeedQuestion(draft.Id, 0, "Fill the blank", type: ExamQuestionType.FillBlank);

        var all = (await Bank().GetPagedAsync(new ExamQuestionBankFilter { Page = 1, PageSize = 20 })).Value;
        Assert.Equal(3, all.TotalCount);
        var item = all.Items.First(x => x.Stem.Contains("mental"));
        Assert.Equal("Đề A", item.ExamTitle);
        Assert.Equal("TL0001", item.MaterialCode);
        Assert.Equal("5", item.GradeBand);

        var onlyTrueFalse = (await Bank().GetPagedAsync(new ExamQuestionBankFilter { Type = ExamQuestionType.TrueFalse, Page = 1, PageSize = 20 })).Value;
        Assert.Single(onlyTrueFalse.Items);

        var onlyPublished = (await Bank().GetPagedAsync(new ExamQuestionBankFilter { ExamStatus = ExamStatus.Published, Page = 1, PageSize = 20 })).Value;
        Assert.Equal(2, onlyPublished.TotalCount);

        // Search khớp stem + mã tài liệu (không phân biệt hoa/thường).
        var byStem = (await Bank().GetPagedAsync(new ExamQuestionBankFilter { Search = "MENTAL", Page = 1, PageSize = 20 })).Value;
        Assert.Single(byStem.Items);
        var byMaterialCode = (await Bank().GetPagedAsync(new ExamQuestionBankFilter { Search = "tl0001", Page = 1, PageSize = 20 })).Value;
        Assert.Equal(2, byMaterialCode.TotalCount);
    }

    [Fact]
    public async Task GetPaged_MaterialSoftDeleted_ItemRemains_MaterialColumnsNull()
    {
        var material = SeedMaterial();
        var exam = SeedExam("Đề A", material.Id);
        SeedQuestion(exam.Id, 0, "Câu 1");

        _context.LearningMaterials.Remove(material); // interceptor chuyển thành xóa mềm
        await _context.SaveChangesAsync();

        var page = (await Bank().GetPagedAsync(new ExamQuestionBankFilter { Page = 1, PageSize = 20 })).Value;
        Assert.Single(page.Items);
        Assert.Null(page.Items[0].MaterialCode);
        Assert.Null(page.Items[0].MaterialTitle);
    }

    [Fact]
    public async Task GetPaged_ExamSoftDeleted_QuestionsDisappear()
    {
        var exam = SeedExam("Đề A");
        SeedQuestion(exam.Id, 0, "Câu 1");
        _context.Exams.Remove(exam);
        await _context.SaveChangesAsync();

        var page = (await Bank().GetPagedAsync(new ExamQuestionBankFilter { Page = 1, PageSize = 20 })).Value;
        Assert.Empty(page.Items);
    }

    [Fact]
    public async Task GetIds_MatchesFilter_NotTruncatedUnderCap()
    {
        var exam = SeedExam("Đề A");
        for (var i = 0; i < 5; i++) SeedQuestion(exam.Id, i, $"Câu {i}");

        var ids = (await Bank().GetIdsAsync(new ExamQuestionBankFilter { ExamId = exam.Id, Page = 1, PageSize = 1 })).Value;
        Assert.Equal(5, ids.Ids.Count);
        Assert.Equal(5, ids.TotalCount);
        Assert.False(ids.Truncated);
    }

    // ---- CreateExamFromQuestions ----

    [Fact]
    public async Task CreateFromQuestions_CopiesInSelectionOrder_RemapsGroup_Distributes10()
    {
        var subjectId = Guid.NewGuid();
        var examA = SeedExam("Đề A", subjectId: subjectId);
        var group = SeedGroup(examA.Id);
        var q1 = SeedQuestion(examA.Id, 0, "A-câu 1", group.Id);
        var q2 = SeedQuestion(examA.Id, 1, "A-câu 2", group.Id);
        var examB = SeedExam("Đề B", subjectId: subjectId);
        var q3 = SeedQuestion(examB.Id, 0, "B-câu 1");

        // Thứ tự chọn: q3 trước, rồi q1, q2 (kèm q3 trùng — dedupe giữ lần đầu).
        var result = await Bank().CreateExamFromQuestionsAsync(
            new CreateExamFromQuestionsRequest("Đề tổng hợp", null, null, "5", 45, [q3.Id, q1.Id, q2.Id, q3.Id]), Guid.NewGuid());

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value.QuestionCount);

        var newExam = await _context.Exams.FirstAsync(e => e.Id == result.Value.ExamId);
        Assert.Equal(ExamGenSource.Manual, newExam.Source);
        Assert.Equal(ExamStatus.Draft, newExam.Status);
        Assert.Equal(subjectId, newExam.SubjectId); // suy từ đề nguồn (cùng 1 môn)
        Assert.Equal(45, newExam.DurationMinutes);

        var newQs = await _context.ExamQuestions.Where(q => q.ExamId == newExam.Id).OrderBy(q => q.OrderNo).ToListAsync();
        Assert.Equal(["B-câu 1", "A-câu 1", "A-câu 2"], newQs.Select(q => q.Stem).ToArray());
        Assert.Equal(10m, newQs.Sum(q => q.Points));

        // Nhóm ngữ liệu được copy (id MỚI, giữ Passage); câu không nhóm giữ GroupId=null.
        var newGroups = await _context.ExamQuestionGroups.Where(g => g.ExamId == newExam.Id).ToListAsync();
        var copied = Assert.Single(newGroups);
        Assert.NotEqual(group.Id, copied.Id);
        Assert.Equal("Đoạn văn X", copied.Passage);
        Assert.Null(newQs[0].GroupId);
        Assert.Equal(copied.Id, newQs[1].GroupId);
        Assert.Equal(copied.Id, newQs[2].GroupId);
    }

    [Fact]
    public async Task CreateFromQuestions_MissingQuestion_Fails()
    {
        var exam = SeedExam("Đề A");
        var q = SeedQuestion(exam.Id, 0, "Câu 1");

        var result = await Bank().CreateExamFromQuestionsAsync(
            new CreateExamFromQuestionsRequest("Đề mới", null, null, null, 60, [q.Id, Guid.NewGuid()]), null);

        Assert.True(result.IsFailure);
        Assert.Equal("ExamBank.QuestionsMissing", result.Error.Code);
    }

    [Fact]
    public async Task CreateFromQuestions_EmptyOrNoTitle_Fails()
    {
        Assert.Equal("ExamBank.TitleRequired",
            (await Bank().CreateExamFromQuestionsAsync(new CreateExamFromQuestionsRequest(" ", null, null, null, 60, [Guid.NewGuid()]), null)).Error.Code);
        Assert.Equal("ExamBank.NoQuestions",
            (await Bank().CreateExamFromQuestionsAsync(new CreateExamFromQuestionsRequest("Đề", null, null, null, 60, []), null)).Error.Code);
    }

    // ---- DuplicateExam ----

    [Fact]
    public async Task Duplicate_CopiesMetaGroupsQuestions_KeepsPointsAndOrder_NewDraft()
    {
        var material = SeedMaterial();
        var exam = SeedExam("Unit 3 Test", material.Id, Guid.NewGuid(), "5", ExamStatus.Published);
        var group = SeedGroup(exam.Id);
        var q1 = SeedQuestion(exam.Id, 0, "Câu 1", group.Id);
        q1.Points = 7m;
        var q2 = SeedQuestion(exam.Id, 1, "Câu 2");
        q2.Points = 3m;
        await _context.SaveChangesAsync();

        var result = await Bank().DuplicateExamAsync(exam.Id, Guid.NewGuid());
        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.QuestionCount);

        var copy = await _context.Exams.FirstAsync(e => e.Id == result.Value.ExamId);
        Assert.Equal("Unit 3 Test (bản sao)", copy.Title);
        Assert.Equal(ExamStatus.Draft, copy.Status);
        Assert.Equal(exam.Source, copy.Source);
        Assert.Equal(exam.MaterialId, copy.MaterialId);

        var copyQs = await _context.ExamQuestions.Where(q => q.ExamId == copy.Id).OrderBy(q => q.OrderNo).ToListAsync();
        Assert.Equal([7m, 3m], copyQs.Select(q => q.Points).ToArray());
        var copyGroup = Assert.Single(await _context.ExamQuestionGroups.Where(g => g.ExamId == copy.Id).ToListAsync());
        Assert.Equal(copyGroup.Id, copyQs[0].GroupId); // remap sang nhóm mới
        Assert.Null(copyQs[1].GroupId);

        Assert.Equal("Exam.NotFound", (await Bank().DuplicateExamAsync(Guid.NewGuid(), null)).Error.Code);
    }
}
