using HungSilver.Application.Abstractions;
using HungSilver.Application.Common.Models;
using HungSilver.Application.Exams;
using HungSilver.Application.Files;
using HungSilver.Application.Materials;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;
using HungSilver.WebApi.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>
/// Chọn nguồn câu hỏi khi sinh đề bằng AI: đề luôn gắn vào tài liệu ở route, nhưng AI có thể đọc
/// file của MỘT TÀI LIỆU KHÁC trong cùng bộ (dùng khi file bài học lẫn cả lý thuyết lẫn bài tập).
/// Validate ngay tại controller để giáo viên nhận lỗi tức thì thay vì đợi job nền báo Failed.
/// </summary>
public sealed class ExamQuestionSourceTests
{
    private static readonly Guid FolderA = Guid.NewGuid();
    private static readonly Guid FolderB = Guid.NewGuid();

    [Fact]
    public async Task Generate_QuestionSourceInSameFolder_PassesThatFileToJob()
    {
        var target = Material("VOCABULARY", FolderA, MaterialSource.ServerFile, Guid.NewGuid());
        var source = Material("BÀI TẬP UNIT 5", FolderA, MaterialSource.ServerFile, Guid.NewGuid());
        var jobs = new FakeJobService();
        var controller = NewController(new LookupMaterialService(target, source), jobs);

        await controller.Generate(target.Id, Request(source.Id), CancellationToken.None);

        Assert.Equal(target.Id, jobs.StartedMaterialId);                    // đề vẫn neo vào tài liệu đích
        Assert.Equal(source.StoredFileId, jobs.StartedSourceStoredFileId);  // nhưng AI đọc file của tài liệu nguồn
    }

    [Fact]
    public async Task Generate_WithoutQuestionSource_ReadsOwnFile()
    {
        var target = Material("VOCABULARY", FolderA, MaterialSource.ServerFile, Guid.NewGuid());
        var jobs = new FakeJobService();
        var controller = NewController(new LookupMaterialService(target), jobs);

        await controller.Generate(target.Id, Request(null), CancellationToken.None);

        Assert.Equal(target.Id, jobs.StartedMaterialId);
        Assert.Null(jobs.StartedSourceStoredFileId); // không override ⇒ service tự lấy file của tài liệu
    }

    [Fact]
    public async Task Generate_QuestionSourceInAnotherFolder_IsRejected()
    {
        var target = Material("VOCABULARY", FolderA, MaterialSource.ServerFile, Guid.NewGuid());
        var source = Material("ĐỀ BỘ KHÁC", FolderB, MaterialSource.ServerFile, Guid.NewGuid());
        var jobs = new FakeJobService();
        var controller = NewController(new LookupMaterialService(target, source), jobs);

        var result = await controller.Generate(target.Id, Request(source.Id), CancellationToken.None);

        AssertProblem(result, "Exam.QuestionSourceInvalid");
        Assert.Null(jobs.StartedMaterialId); // không enqueue job hỏng
    }

    [Fact]
    public async Task Generate_QuestionSourceIsExternalUrl_IsRejected()
    {
        var target = Material("VOCABULARY", FolderA, MaterialSource.ServerFile, Guid.NewGuid());
        var source = Material("LINK NGOÀI", FolderA, MaterialSource.ExternalUrl, null);
        var jobs = new FakeJobService();
        var controller = NewController(new LookupMaterialService(target, source), jobs);

        var result = await controller.Generate(target.Id, Request(source.Id), CancellationToken.None);

        AssertProblem(result, "Exam.QuestionSourceNotFile");
        Assert.Null(jobs.StartedMaterialId);
    }

    [Fact]
    public async Task Generate_QuestionSourceNotFound_IsRejected()
    {
        var target = Material("VOCABULARY", FolderA, MaterialSource.ServerFile, Guid.NewGuid());
        var jobs = new FakeJobService();
        var controller = NewController(new LookupMaterialService(target), jobs);

        var result = await controller.Generate(target.Id, Request(Guid.NewGuid()), CancellationToken.None);

        AssertProblem(result, "Exam.QuestionSourceNotFound");
        Assert.Null(jobs.StartedMaterialId);
    }

    // ----- Helpers -----

    private static void AssertProblem(ActionResult<ExamGenerationJobStartResult> result, string expectedCode)
    {
        var error = Assert.IsType<ObjectResult>(result.Result);
        var problem = Assert.IsType<ProblemDetails>(error.Value);
        Assert.Equal(expectedCode, problem.Title);
    }

    private static GenerateExamRequest Request(Guid? questionSourceMaterialId) =>
        new(ExamGenerationMode.Extract, "Đề thử", 30, null, null, null, true, questionSourceMaterialId);

    private static MaterialDto Material(string title, Guid? folderId, MaterialSource source, Guid? storedFileId) =>
        new(Guid.NewGuid(), "TL0001", folderId, null, Guid.NewGuid(), "Tiếng Anh", "9",
            title, source, source == MaterialSource.ExternalUrl ? "https://x.vn" : null, storedFileId,
            "file.pdf", null, null, "/api/files/x", 0, DateTime.Now);

    private static ExamsController NewController(IMaterialService materials, IExamGenerationJobService jobs)
    {
        var controller = new ExamsController(
            new StubExamService(), jobs, new StubAssignments(), new StubReports(),
            new StubQuestionBank(), materials, new StubFileService(), new StubCurrentUser());
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        return controller;
    }

    /// <summary>Tra tài liệu theo Id trong tập đã seed; không có ⇒ NotFound (giống service thật).</summary>
    private sealed class LookupMaterialService(params MaterialDto[] materials) : IMaterialService
    {
        public Task<Result<PagedResult<MaterialDto>>> GetPagedAsync(MaterialListFilter filter, PagedRequest paging, CancellationToken ct = default) =>
            throw new NotImplementedException();

        public Task<Result<MaterialDto>> GetByIdAsync(Guid id, CancellationToken ct = default)
        {
            var found = materials.FirstOrDefault(m => m.Id == id);
            return Task.FromResult(found is null
                ? Result.Failure<MaterialDto>(Error.NotFound("Material.NotFound", "Không tìm thấy tài liệu."))
                : Result.Success(found));
        }

        public Task<Result<MaterialDto>> CreateAsync(CreateMaterialRequest request, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result<MaterialDto>> UpdateAsync(Guid id, UpdateMaterialRequest request, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result> DeleteAsync(Guid id, CancellationToken ct = default) => throw new NotImplementedException();
    }

    private sealed class FakeJobService : IExamGenerationJobService
    {
        public Guid? StartedMaterialId { get; private set; }
        public Guid? StartedSourceStoredFileId { get; private set; }

        public Task<Result<ExamGenerationJobStartResult>> StartAsync(
            Guid materialId, GenerateExamRequest request, Guid userId, Guid? sourceStoredFileId = null, CancellationToken ct = default)
        {
            StartedMaterialId = materialId;
            StartedSourceStoredFileId = sourceStoredFileId;
            return Task.FromResult(Result.Success(
                new ExamGenerationJobStartResult(Guid.NewGuid(), ExamGenerationJobStatus.Queued, DateTime.Now, 2)));
        }

        public Result<ExamGenerationJobDto> Get(Guid jobId, Guid userId) => throw new NotImplementedException();
    }

    private sealed class StubFileService : IFileService
    {
        public Task<Result<StoredFileDto>> UploadAsync(Stream content, string fileName, string contentType, long length,
            bool enforceStorageMode = true, FileVisibility visibility = FileVisibility.Authenticated, CancellationToken ct = default) =>
            throw new NotImplementedException();

        public Task<Result<StoredFileInfo>> GetInfoAsync(Guid id, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result<StoredFileDownload>> GetForDownloadAsync(Guid id, CancellationToken ct = default) => throw new NotImplementedException();
    }

    private sealed class StubCurrentUser : ICurrentUser
    {
        public Guid? UserId { get; } = Guid.NewGuid();
        public string? Email => "gv@hungsilver.local";
        public bool IsAuthenticated => true;
        public bool IsInRole(string role) => true;
    }

    private sealed class StubExamService : IExamService
    {
        public Task<Result<PagedResult<ExamListItemDto>>> GetPagedAsync(ExamListFilter filter, PagedRequest paging, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result<ExamDetailDto>> GetDetailAsync(Guid examId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result<ExamDetailDto>> UpdateExamAsync(Guid examId, UpdateExamRequest request, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result<ExamQuestionDto>> UpsertQuestionAsync(Guid examId, Guid? questionId, UpsertQuestionRequest request, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result> DeleteQuestionAsync(Guid examId, Guid questionId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result> PublishAsync(Guid examId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result> DeleteAsync(Guid examId, CancellationToken ct = default) => throw new NotImplementedException();
    }

    private sealed class StubAssignments : IExamAssignmentService
    {
        public Task<Result<ExamAssignmentDto>> AssignAsync(Guid examId, AssignExamRequest request, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result<List<ExamAssignmentDto>>> ListByExamAsync(Guid examId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result<PagedResult<ExamAssignmentDto>>> GetPagedAsync(Guid? classId, ExamAssignmentStatus? status, PagedRequest paging, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result<List<ExamAssignmentDto>>> ListBySessionAsync(Guid sessionId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result<List<ExamAssignmentDto>>> ListByClassAsync(Guid classId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result<List<StudentHomeworkDto>>> ListStudentHomeworkAsync(Guid studentId, Guid? classId = null, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result> CloseAsync(Guid assignmentId, CancellationToken ct = default) => throw new NotImplementedException();
    }

    private sealed class StubReports : IExamReportService
    {
        public Task<Result<ExamReportDto>> GetReportAsync(Guid assignmentId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result<TeacherAttemptReviewDto>> GetAttemptReviewAsync(Guid attemptId, CancellationToken ct = default) => throw new NotImplementedException();
    }

    private sealed class StubQuestionBank : IExamQuestionBankService
    {
        public Task<Result<PagedResult<ExamQuestionBankItemDto>>> GetPagedAsync(ExamQuestionBankFilter filter, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result<ExamQuestionIdsDto>> GetIdsAsync(ExamQuestionBankFilter filter, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result<CreateExamFromQuestionsResult>> CreateExamFromQuestionsAsync(CreateExamFromQuestionsRequest request, Guid? userId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result<CreateExamFromQuestionsResult>> DuplicateExamAsync(Guid examId, Guid? userId, CancellationToken ct = default) => throw new NotImplementedException();
    }
}
