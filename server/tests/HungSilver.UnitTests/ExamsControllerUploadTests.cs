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
/// Kiểm thử endpoint upload file tạo đề: tạo tài liệu mới ngang hàng với tài liệu nguồn,
/// enqueue job sinh đề và chặn loại file chưa hỗ trợ.
/// </summary>
public sealed class ExamsControllerUploadTests
{
    [Fact]
    public async Task GenerateFromUpload_InFolder_CreatesSiblingMaterial_AndStartsJob()
    {
        var sourceMaterialId = Guid.NewGuid();
        var folderId = Guid.NewGuid();
        var newMaterialId = Guid.NewGuid();
        var materialService = new FakeMaterialService(new MaterialDto(
            sourceMaterialId, "TL0001", null, folderId, null, null,
            Guid.NewGuid(), "Tiếng Anh", "10", "Unit 3",
            MaterialSource.ServerFile, null, Guid.NewGuid(), "unit.docx", null, null, "/api/files/x", DateTime.Now),
            newMaterialId);
        var files = new FakeFileService(Guid.NewGuid());
        var jobs = new FakeJobService();
        var controller = NewController(materialService, files, jobs);

        var result = await controller.GenerateFromUpload(sourceMaterialId, new GenerateExamUploadForm
        {
            File = FormFile("uploaded.docx"),
            MaterialTitle = "Unit 4",
            Mode = ExamGenerationMode.Extract,
            ExamTitle = "Đề Unit 4",
            DurationMinutes = 45,
            Verify = true
        }, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.IsType<ExamGenerationJobStartResult>(ok.Value);
        Assert.Equal(folderId, materialService.CreatedRequest!.FolderId);
        Assert.Null(materialService.CreatedRequest.SubjectId);
        Assert.Null(materialService.CreatedRequest.CategoryId);
        Assert.Equal("Unit 4", materialService.CreatedRequest.Title);
        Assert.Equal(files.StoredFileId, materialService.CreatedRequest.StoredFileId);
        Assert.Equal(newMaterialId, jobs.StartedMaterialId);
        Assert.Equal("Đề Unit 4", jobs.StartedRequest!.Title);
    }

    [Fact]
    public async Task GenerateFromUpload_GeneralMaterial_CopiesCategorySubjectGrade()
    {
        var sourceMaterialId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var materialService = new FakeMaterialService(new MaterialDto(
            sourceMaterialId, "TL0002", null, null, categoryId, "Đề kiểm tra",
            subjectId, "Tiếng Anh", "9", "Tài liệu chung",
            MaterialSource.ServerFile, null, Guid.NewGuid(), "unit.pdf", null, null, "/api/files/x", DateTime.Now),
            Guid.NewGuid());
        var controller = NewController(materialService, new FakeFileService(Guid.NewGuid()), new FakeJobService());

        await controller.GenerateFromUpload(sourceMaterialId, new GenerateExamUploadForm
        {
            File = FormFile("uploaded.pdf"),
            MaterialTitle = "Đề giữa kỳ"
        }, CancellationToken.None);

        Assert.Null(materialService.CreatedRequest!.FolderId);
        Assert.Equal(categoryId, materialService.CreatedRequest.CategoryId);
        Assert.Equal(subjectId, materialService.CreatedRequest.SubjectId);
        Assert.Equal("9", materialService.CreatedRequest.GradeBand);
    }

    [Fact]
    public async Task GenerateFromUpload_UnsupportedFile_ReturnsValidation()
    {
        var controller = NewController(
            new FakeMaterialService(defaultMaterial: null, Guid.NewGuid()),
            new FakeFileService(Guid.NewGuid()),
            new FakeJobService());

        var result = await controller.GenerateFromUpload(Guid.NewGuid(), new GenerateExamUploadForm
        {
            File = FormFile("bad.zip"),
            MaterialTitle = "Tài liệu zip"
        }, CancellationToken.None);

        var error = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status400BadRequest, error.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(error.Value);
        Assert.Equal("ExamUpload.UnsupportedFile", problem.Title);
    }

    private static ExamsController NewController(
        IMaterialService materials,
        IFileService files,
        IExamGenerationJobService jobs)
    {
        var controller = new ExamsController(
            new StubExamService(),
            jobs,
            new StubAssignments(),
            new StubReports(),
            new StubQuestionBank(),
            materials,
            files,
            new StubCurrentUser());
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        return controller;
    }

    private static IFormFile FormFile(string fileName)
    {
        var bytes = new byte[] { 1, 2, 3 };
        return new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/octet-stream"
        };
    }

    private sealed class FakeMaterialService(MaterialDto? defaultMaterial, Guid newMaterialId) : IMaterialService
    {
        public CreateMaterialRequest? CreatedRequest { get; private set; }

        public Task<Result<PagedResult<MaterialDto>>> GetPagedAsync(MaterialListFilter filter, PagedRequest paging, CancellationToken ct = default) =>
            Task.FromResult(Result.Failure<PagedResult<MaterialDto>>(Error.Failure("Test.NotUsed", "Không dùng trong test.")));

        public Task<Result<MaterialDto>> GetByIdAsync(Guid id, CancellationToken ct = default) =>
            Task.FromResult(defaultMaterial is null
                ? Result.Failure<MaterialDto>(Error.NotFound("Material.NotFound", "Không tìm thấy tài liệu."))
                : Result.Success(defaultMaterial));

        public Task<Result<MaterialDto>> CreateAsync(CreateMaterialRequest request, CancellationToken ct = default)
        {
            CreatedRequest = request;
            return Task.FromResult<Result<MaterialDto>>(new MaterialDto(
                newMaterialId, "TL9999", null, request.FolderId, request.CategoryId, null, request.SubjectId, null,
                request.GradeBand, request.Title, request.Source, request.Url, request.StoredFileId, "uploaded.pdf",
                request.CoverFileId, request.Description, "/api/files/new", DateTime.Now));
        }

        public Task<Result<MaterialDto>> UpdateAsync(Guid id, UpdateMaterialRequest request, CancellationToken ct = default) =>
            Task.FromResult(Result.Failure<MaterialDto>(Error.Failure("Test.NotUsed", "Không dùng trong test.")));

        public Task<Result> DeleteAsync(Guid id, CancellationToken ct = default) =>
            Task.FromResult(Result.Failure(Error.Failure("Test.NotUsed", "Không dùng trong test.")));
    }

    private sealed class FakeFileService(Guid storedFileId) : IFileService
    {
        public Guid StoredFileId => storedFileId;

        public Task<Result<StoredFileDto>> UploadAsync(
            Stream content, string fileName, string contentType, long length,
            bool enforceStorageMode = true,
            FileVisibility visibility = FileVisibility.Authenticated,
            CancellationToken ct = default) =>
            Task.FromResult<Result<StoredFileDto>>(new StoredFileDto(storedFileId, fileName, contentType, length, $"/api/files/{storedFileId}"));

        public Task<Result<StoredFileInfo>> GetInfoAsync(Guid id, CancellationToken ct = default) =>
            Task.FromResult(Result.Failure<StoredFileInfo>(Error.Failure("Test.NotUsed", "Không dùng trong test.")));

        public Task<Result<StoredFileDownload>> GetForDownloadAsync(Guid id, CancellationToken ct = default) =>
            Task.FromResult(Result.Failure<StoredFileDownload>(Error.Failure("Test.NotUsed", "Không dùng trong test.")));
    }

    private sealed class FakeJobService : IExamGenerationJobService
    {
        public Guid StartedMaterialId { get; private set; }
        public GenerateExamRequest? StartedRequest { get; private set; }

        public Task<Result<ExamGenerationJobStartResult>> StartAsync(Guid materialId, GenerateExamRequest request, Guid userId, CancellationToken ct = default)
        {
            StartedMaterialId = materialId;
            StartedRequest = request;
            return Task.FromResult<Result<ExamGenerationJobStartResult>>(
                new ExamGenerationJobStartResult(Guid.NewGuid(), ExamGenerationJobStatus.Queued, DateTime.Now, 2));
        }

        public Result<ExamGenerationJobDto> Get(Guid jobId, Guid userId) =>
            Result.Failure<ExamGenerationJobDto>(Error.Failure("Test.NotUsed", "Không dùng trong test."));
    }

    private sealed class StubCurrentUser : ICurrentUser
    {
        public Guid? UserId => Guid.Parse("22222222-2222-2222-2222-222222222222");
        public string? Email => "teacher@hedu.local";
        public bool IsAuthenticated => true;
        public bool IsInRole(string role) => true;
    }

    private sealed class StubExamService : IExamService
    {
        public Task<Result<PagedResult<ExamListItemDto>>> GetPagedBySubjectAsync(Guid subjectId, ExamStatus? status, PagedRequest paging, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result<PagedResult<ExamListItemDto>>> GetPagedByMaterialAsync(Guid materialId, PagedRequest paging, CancellationToken ct = default) => throw new NotImplementedException();
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
        public Task<Result> CloseAsync(Guid assignmentId, CancellationToken ct = default) => throw new NotImplementedException();
    }

    private sealed class StubReports : IExamReportService
    {
        public Task<Result<ExamReportDto>> GetReportAsync(Guid assignmentId, CancellationToken ct = default) => throw new NotImplementedException();
    }

    private sealed class StubQuestionBank : IExamQuestionBankService
    {
        public Task<Result<PagedResult<ExamQuestionBankItemDto>>> GetPagedAsync(ExamQuestionBankFilter filter, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result<ExamQuestionIdsDto>> GetIdsAsync(ExamQuestionBankFilter filter, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result<CreateExamFromQuestionsResult>> CreateExamFromQuestionsAsync(CreateExamFromQuestionsRequest request, Guid? userId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Result<CreateExamFromQuestionsResult>> DuplicateExamAsync(Guid examId, Guid? userId, CancellationToken ct = default) => throw new NotImplementedException();
    }
}
