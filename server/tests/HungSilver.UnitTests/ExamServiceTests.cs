using HungSilver.Application.Exams;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using HungSilver.Infrastructure.Persistence.Interceptors;
using HungSilver.Infrastructure.Persistence.Repositories;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>
/// ExamService: chia lại điểm khi thêm/xóa câu (soạn tay tổng luôn = TotalPoints) và
/// KHÓA cấu trúc đề đã giao cho lớp (sửa/xóa câu, đổi thời gian, xóa đề ⇒ lỗi Exam.Assigned*).
/// </summary>
public sealed class ExamServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;

    public ExamServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection).AddInterceptors(new AuditSaveChangesInterceptor()).Options;
        _context = new AppDbContext(options);
        _context.Database.EnsureCreated();
    }

    public void Dispose() { _context.Dispose(); _connection.Dispose(); }

    private ExamService Service() => new(
        new Repository<Exam>(_context),
        new Repository<ExamQuestionGroup>(_context),
        new Repository<ExamQuestion>(_context),
        new Repository<LearningMaterial>(_context),
        new Repository<ExamAssignment>(_context),
        new Repository<StoredFile>(_context),
        new AdminGuard(),
        new FakeUserDirectory(),
        new UnitOfWork(_context));

    private Exam SeedExam(ExamStatus status = ExamStatus.Draft)
    {
        var e = new Exam { Title = "Đề test", Status = status, TotalPoints = 10m, DurationMinutes = 60 };
        _context.Exams.Add(e);
        _context.SaveChanges();
        return e;
    }

    private ExamQuestion SeedQuestion(Guid examId, int order, decimal points)
    {
        var q = new ExamQuestion
        {
            ExamId = examId, OrderNo = order, Type = ExamQuestionType.TrueFalse,
            Stem = $"Câu {order + 1}", AnswerJson = "{\"value\":true}", Points = points
        };
        _context.ExamQuestions.Add(q);
        _context.SaveChanges();
        return q;
    }

    private void SeedAssignment(Guid examId)
    {
        _context.ExamAssignments.Add(new ExamAssignment
        {
            ExamId = examId, ExamTitle = "Đề test", ClassId = Guid.NewGuid(),
            DurationMinutes = 60, OpenAt = DateTime.Now, TotalPoints = 10m, Status = ExamAssignmentStatus.Open
        });
        _context.SaveChanges();
    }

    private static UpsertQuestionRequest TrueFalseRequest(string stem = "Câu mới") =>
        new(null, ExamQuestionType.TrueFalse, stem, null, null, "true", null, null, null, null);

    // ---- Fix D: chia lại điểm ----

    [Fact]
    public async Task AddQuestion_Redistributes_AllQuestionsSum10()
    {
        var exam = SeedExam();
        SeedQuestion(exam.Id, 0, 5m);
        SeedQuestion(exam.Id, 1, 5m);

        var result = await Service().UpsertQuestionAsync(exam.Id, null, TrueFalseRequest());
        Assert.True(result.IsSuccess);
        Assert.True(result.Value.Points > 0m); // câu mới KHÔNG còn 0 điểm

        var all = await _context.ExamQuestions.Where(q => q.ExamId == exam.Id).OrderBy(q => q.OrderNo).ToListAsync();
        Assert.Equal(3, all.Count);
        Assert.Equal(10m, all.Sum(q => q.Points));
        Assert.Equal(3.34m, all[0].Points); // câu đầu nhận phần dư
    }

    [Fact]
    public async Task DeleteQuestion_Redistributes_RemainingSum10()
    {
        var exam = SeedExam();
        SeedQuestion(exam.Id, 0, 3.34m);
        var q2 = SeedQuestion(exam.Id, 1, 3.33m);
        SeedQuestion(exam.Id, 2, 3.33m);

        Assert.True((await Service().DeleteQuestionAsync(exam.Id, q2.Id)).IsSuccess);

        var remaining = await _context.ExamQuestions.Where(q => q.ExamId == exam.Id).ToListAsync();
        Assert.Equal(2, remaining.Count);
        Assert.Equal(10m, remaining.Sum(q => q.Points));
        Assert.All(remaining, q => Assert.Equal(5m, q.Points));
    }

    // ---- Fix C: khóa đề đã giao ----

    [Fact]
    public async Task AssignedExam_BlocksQuestionUpsertAndDelete()
    {
        var exam = SeedExam(ExamStatus.Published);
        var q = SeedQuestion(exam.Id, 0, 10m);
        SeedAssignment(exam.Id);
        var svc = Service();

        Assert.Equal("Exam.Assigned", (await svc.UpsertQuestionAsync(exam.Id, null, TrueFalseRequest())).Error.Code);
        Assert.Equal("Exam.Assigned", (await svc.UpsertQuestionAsync(exam.Id, q.Id, TrueFalseRequest("Sửa"))).Error.Code);
        Assert.Equal("Exam.Assigned", (await svc.DeleteQuestionAsync(exam.Id, q.Id)).Error.Code);
    }

    [Fact]
    public async Task AssignedExam_BlocksDurationChange_AllowsTitleEdit()
    {
        var exam = SeedExam(ExamStatus.Published);
        SeedQuestion(exam.Id, 0, 10m);
        SeedAssignment(exam.Id);
        var svc = Service();

        var changed = await svc.UpdateExamAsync(exam.Id, new UpdateExamRequest("Đề test", null, null, 45));
        Assert.Equal("Exam.AssignedDuration", changed.Error.Code);

        var renamed = await svc.UpdateExamAsync(exam.Id, new UpdateExamRequest("Tên mới", "mô tả", "5", 60));
        Assert.True(renamed.IsSuccess);
        Assert.Equal("Tên mới", renamed.Value.Title);
    }

    [Fact]
    public async Task AssignedExam_BlocksDelete_UnassignedDeletes()
    {
        var assigned = SeedExam(ExamStatus.Published);
        SeedQuestion(assigned.Id, 0, 10m);
        SeedAssignment(assigned.Id);
        Assert.Equal("Exam.AssignedDelete", (await Service().DeleteAsync(assigned.Id)).Error.Code);

        var free = SeedExam();
        SeedQuestion(free.Id, 0, 10m);
        Assert.True((await Service().DeleteAsync(free.Id)).IsSuccess);
        Assert.Empty(await _context.Exams.Where(e => e.Id == free.Id).ToListAsync()); // xóa mềm ⇒ query filter ẩn
    }

    [Fact]
    public async Task ListAndDetail_ReturnCreatorName_AndPreviewUrl()
    {
        var userId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var storedFileId = Guid.NewGuid();
        var material = new LearningMaterial
        {
            Title = "Unit 3",
            Source = MaterialSource.ServerFile,
            StoredFileId = storedFileId
        };
        _context.LearningMaterials.Add(material);
        var exam = new Exam
        {
            MaterialId = material.Id,
            Title = "Đề test",
            Status = ExamStatus.Draft,
            TotalPoints = 10m,
            DurationMinutes = 60,
            CreatedByUserId = userId
        };
        _context.Exams.Add(exam);
        await _context.SaveChangesAsync();

        var list = await Service().GetPagedAsync(
            new ExamListFilter(MaterialId: material.Id), new HungSilver.Application.Common.Models.PagedRequest());
        Assert.True(list.IsSuccess);
        Assert.Equal("Cô Hương", list.Value.Items.Single().CreatedByName);

        var detail = await Service().GetDetailAsync(exam.Id);
        Assert.True(detail.IsSuccess);
        Assert.Equal("Cô Hương", detail.Value.CreatedByName);
        Assert.Equal($"/api/files/{storedFileId}", detail.Value.SourceFileUrl);
        Assert.Equal($"/api/files/{storedFileId}/preview", detail.Value.SourceFilePreviewUrl);
    }

    [Fact]
    public async Task Detail_PrefersExamSourceStoredFileId_OverMaterialFile()
    {
        // Đề từ luồng generate-upload: file snapshot trên đề khác file của tài liệu nguồn — phải ưu tiên snapshot.
        var materialFileId = Guid.NewGuid();
        var uploadedFileId = Guid.NewGuid();
        var material = new LearningMaterial
        {
            Title = "Unit 3",
            Source = MaterialSource.ServerFile,
            StoredFileId = materialFileId
        };
        _context.LearningMaterials.Add(material);
        var exam = new Exam
        {
            MaterialId = material.Id,
            SourceStoredFileId = uploadedFileId,
            Title = "Đề upload",
            Status = ExamStatus.Draft,
            TotalPoints = 10m,
            DurationMinutes = 60
        };
        _context.Exams.Add(exam);
        await _context.SaveChangesAsync();

        var detail = await Service().GetDetailAsync(exam.Id);

        Assert.True(detail.IsSuccess);
        Assert.Equal($"/api/files/{uploadedFileId}", detail.Value.SourceFileUrl);
        Assert.Equal($"/api/files/{uploadedFileId}/preview", detail.Value.SourceFilePreviewUrl);
    }

    private sealed class AdminGuard : IClassAccessGuard
    {
        public bool IsAdmin => true;
        public Task<Guid?> GetTeacherScopeIdAsync(CancellationToken ct = default) => Task.FromResult<Guid?>(null);
        public Task<List<Guid>> GetOwnedClassIdsAsync(CancellationToken ct = default) => Task.FromResult(new List<Guid>());
        public Task<Result> EnsureCanAccessClassAsync(Guid classId, CancellationToken ct = default) => Task.FromResult(Result.Success());
        public Task<bool> CanAccessClassAsync(Guid classId, CancellationToken ct = default) => Task.FromResult(true);
        public Task<Result> EnsureCanAccessStudentAsync(Guid studentId, CancellationToken ct = default) => Task.FromResult(Result.Success());
    }

    private sealed class FakeUserDirectory : IUserDirectory
    {
        public Task<bool> ExistsAsync(Guid userId, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> IsInRoleAsync(Guid userId, string role, CancellationToken ct = default) => Task.FromResult(false);
        public Task<Dictionary<Guid, string>> GetDisplayNamesAsync(IEnumerable<Guid> userIds, CancellationToken ct = default) =>
            Task.FromResult(userIds.Distinct().ToDictionary(id => id, _ => "Cô Hương"));
        public Task<Dictionary<Guid, AccountInfo>> GetAccountInfosAsync(IEnumerable<Guid> userIds, CancellationToken ct = default) =>
            Task.FromResult(new Dictionary<Guid, AccountInfo>());
        public Task<List<UserSummary>> GetUsersInRoleAsync(string role, CancellationToken ct = default) => Task.FromResult(new List<UserSummary>());
        public Task<IReadOnlyList<string>> GetRolesAsync(Guid userId, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<string>>(Array.Empty<string>());
        public Task<Guid?> GetRoleIdAsync(string role, CancellationToken ct = default) => Task.FromResult<Guid?>(null);
    }
}
