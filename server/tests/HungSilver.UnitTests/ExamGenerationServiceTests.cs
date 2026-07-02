using HungSilver.Application.Abstractions;
using HungSilver.Application.AiCredentials;
using HungSilver.Application.Exams;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Exams;
using HungSilver.Infrastructure.Persistence;
using HungSilver.Infrastructure.Persistence.Interceptors;
using HungSilver.Infrastructure.Persistence.Repositories;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>
/// Kiểm thử lõi sinh đề (§A) — Lớp 1: loại câu sai cấu trúc, chia đều điểm/10, phát hiện lỗ hổng số thứ tự,
/// và ánh xạ đúng đáp án 4 loại. Dùng Gemini/nguồn giả (không gọi mạng).
/// </summary>
public sealed class ExamGenerationServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;
    private readonly FakeGemini _gemini = new();
    private readonly Guid _materialId;

    public ExamGenerationServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .AddInterceptors(new AuditSaveChangesInterceptor())
            .Options;
        _context = new AppDbContext(options);
        _context.Database.EnsureCreated();

        var material = new LearningMaterial
        {
            Title = "Unit 3",
            Source = MaterialSource.ServerFile,
            StoredFileId = Guid.NewGuid(),
            SubjectId = Guid.NewGuid(),
            SubjectName = "Tiếng Anh"
        };
        _context.LearningMaterials.Add(material);
        _context.SaveChanges();
        _materialId = material.Id;
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    private ExamGenerationService NewService() => new(
        new Repository<LearningMaterial>(_context),
        new Repository<Exam>(_context),
        new Repository<ExamQuestionGroup>(_context),
        new Repository<ExamQuestion>(_context),
        new UnitOfWork(_context),
        new FakeResolver(),
        _gemini,
        new FakeSource());

    private static GenerateExamRequest ExtractReq() =>
        new(ExamGenerationMode.Extract, Title: "Đề 1", DurationMinutes: 45, MaxQuestions: null, Difficulty: null, Instructions: null, Verify: false);

    [Fact]
    public async Task DropsInvalidQuestions_AndDistributesPoints()
    {
        _gemini.NextJson = """
        {"groups":[{"exerciseLabel":"Exercise 1","questions":[
          {"number":1,"type":"SingleChoice","stem":"Q1","options":[{"key":"A","text":"a"},{"key":"B","text":"b"}],"answerKey":"B","explanation":"vì B"},
          {"number":2,"type":"SingleChoice","stem":"Q2","options":[{"key":"A","text":"a"},{"key":"B","text":"b"}],"answerKey":"Z","explanation":"key sai ⇒ loại"}
        ]}]}
        """;

        var result = await NewService().GenerateFromMaterialAsync(_materialId, ExtractReq(), Guid.NewGuid());

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Value.QuestionCount);
        Assert.Equal(1, result.Value.DroppedCount);

        var exam = await _context.Exams.SingleAsync();
        Assert.Equal(ExamStatus.Draft, exam.Status);
        Assert.Equal("Đề 1", exam.Title);
        Assert.Equal(45, exam.DurationMinutes);

        var qs = await _context.ExamQuestions.ToListAsync();
        Assert.Single(qs);
        Assert.Equal(10m, qs.Sum(q => q.Points)); // tổng điểm = 10
        Assert.Contains("\"key\":\"B\"", qs[0].AnswerJson);
    }

    [Fact]
    public async Task MapsAllFourTypes_WithCorrectAnswers()
    {
        _gemini.NextJson = """
        {"groups":[{"questions":[
          {"number":1,"type":"TrueFalse","stem":"T/F","answerKey":"false","explanation":"e"},
          {"number":2,"type":"FillBlank","stem":"___","answerBlanks":["mental"],"wordBox":["mental","priority"],"explanation":"e"},
          {"number":3,"type":"Matching","stem":"match","options":[{"key":"1","text":"l1"}],"optionsRight":[{"key":"a","text":"r1"}],"answerPairs":[{"left":"1","right":"a"}],"explanation":"e"}
        ]}]}
        """;

        var result = await NewService().GenerateFromMaterialAsync(_materialId, ExtractReq(), Guid.NewGuid());

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value.QuestionCount);

        var qs = await _context.ExamQuestions.OrderBy(q => q.OrderNo).ToListAsync();
        Assert.Contains("\"value\":false", qs[0].AnswerJson);
        Assert.Contains("mental", qs[1].AnswerJson);
        Assert.Contains("\"1\":\"a\"", qs[2].AnswerJson);
        Assert.Equal(10m, qs.Sum(q => q.Points));
    }

    [Fact]
    public async Task FlagsNumberGaps_AsWarning()
    {
        _gemini.NextJson = """
        {"groups":[{"exerciseLabel":"Exercise 7","questions":[
          {"number":1,"type":"TrueFalse","stem":"a","answerKey":"true","explanation":"e"},
          {"number":2,"type":"TrueFalse","stem":"b","answerKey":"true","explanation":"e"},
          {"number":4,"type":"TrueFalse","stem":"d","answerKey":"false","explanation":"e"}
        ]}]}
        """;

        var result = await NewService().GenerateFromMaterialAsync(_materialId, ExtractReq(), Guid.NewGuid());

        Assert.True(result.IsSuccess);
        Assert.Contains(result.Value.Warnings, w => w.Contains("thiếu câu số 3"));
    }

    [Fact]
    public async Task NoKey_ReturnsKeyMissing()
    {
        _gemini.NextJson = "{\"groups\":[]}";
        var svc = new ExamGenerationService(
            new Repository<LearningMaterial>(_context), new Repository<Exam>(_context),
            new Repository<ExamQuestionGroup>(_context), new Repository<ExamQuestion>(_context),
            new UnitOfWork(_context), new FakeResolver { HasKey = false }, _gemini, new FakeSource());

        var result = await svc.GenerateFromMaterialAsync(_materialId, ExtractReq(), Guid.NewGuid());

        Assert.True(result.IsFailure);
        Assert.Equal("Ai.KeyMissing", result.Error.Code);
    }

    // ----- Fakes -----

    private sealed class FakeResolver : IAiCredentialResolver
    {
        public bool HasKey { get; set; } = true;
        public Task<Result<string>> GetApiKeyForUserAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(HasKey ? Result.Success("key") : Result.Failure<string>(Error.NotFound("Ai.KeyMissing", "x")));
        public Task<Result<ResolvedAiCredential>> ResolveForUserAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult(HasKey
                ? Result.Success(new ResolvedAiCredential("key", "gemini-2.5-flash"))
                : Result.Failure<ResolvedAiCredential>(Error.NotFound("Ai.KeyMissing", "Chưa cấu hình key.")));
    }

    private sealed class FakeSource : IExamSourceProvider
    {
        public Task<Result<GeminiInlineDoc>> GetPdfPartAsync(Guid storedFileId, CancellationToken ct = default) =>
            Task.FromResult(Result.Success(new GeminiInlineDoc("application/pdf", new byte[] { 1, 2, 3 })));
    }

    private sealed class FakeGemini : IGeminiClient
    {
        public string NextJson { get; set; } = "{\"groups\":[]}";
        public Task<Result> ValidateKeyAsync(string apiKey, string? model = null, CancellationToken ct = default) => Task.FromResult(Result.Success());
        public Task<Result<string>> GenerateContentAsync(GeminiContentRequest request, CancellationToken ct = default) =>
            Task.FromResult(Result.Success(NextJson));
    }
}
