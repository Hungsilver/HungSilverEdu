using HungSilver.Application.Abstractions;
using HungSilver.Application.Files;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;
using HungSilver.WebApi.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>
/// Kiểm thử endpoint xem trước file: PDF inline, Word chuyển PDF, file không hỗ trợ không bị ép tải xuống,
/// và phân quyền giống nhánh download.
/// </summary>
public sealed class FilesControllerPreviewTests
{
    [Fact]
    public async Task Preview_Pdf_ReturnsInlinePdf()
    {
        var fileId = Guid.NewGuid();
        await using var content = new MemoryStream([1, 2, 3]);
        var controller = NewController(
            new FakeFileService(fileId, "unit.pdf", "application/pdf", content),
            new FakeCurrentUser(isAuthenticated: true, isTeacher: true),
            new FakeConverter());

        var result = await controller.Preview(fileId, CancellationToken.None);

        var file = Assert.IsType<FileStreamResult>(result);
        Assert.Equal("application/pdf", file.ContentType);
        Assert.Contains("inline", controller.Response.Headers.ContentDisposition.ToString());
    }

    [Fact]
    public async Task Preview_Docx_ConvertsToPdf()
    {
        var fileId = Guid.NewGuid();
        await using var content = new MemoryStream([1, 2, 3]);
        var converter = new FakeConverter([9, 8, 7]);
        var controller = NewController(
            new FakeFileService(fileId, "Unit 3.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", content),
            new FakeCurrentUser(isAuthenticated: true, isTeacher: true),
            converter);

        var result = await controller.Preview(fileId, CancellationToken.None);

        var file = Assert.IsType<FileContentResult>(result);
        Assert.Equal("application/pdf", file.ContentType);
        Assert.Equal([9, 8, 7], file.FileContents);
        Assert.True(converter.Called);
        Assert.Contains("inline", controller.Response.Headers.ContentDisposition.ToString());
    }

    [Fact]
    public async Task Preview_UnsupportedFile_ReturnsValidationError()
    {
        var fileId = Guid.NewGuid();
        await using var content = new MemoryStream([1, 2, 3]);
        var controller = NewController(
            new FakeFileService(fileId, "archive.zip", "application/zip", content),
            new FakeCurrentUser(isAuthenticated: true, isTeacher: true),
            new FakeConverter());

        var result = await controller.Preview(fileId, CancellationToken.None);

        var error = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status400BadRequest, error.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(error.Value);
        Assert.Equal("Files.PreviewUnsupported", problem.Title);
    }

    [Fact]
    public async Task Preview_RestrictedFile_ForNonOwnerNonTeacher_ReturnsForbidden()
    {
        var fileId = Guid.NewGuid();
        await using var content = new MemoryStream([1, 2, 3]);
        var controller = NewController(
            new FakeFileService(fileId, "unit.pdf", "application/pdf", content, FileVisibility.Restricted, Guid.NewGuid()),
            new FakeCurrentUser(isAuthenticated: true, isTeacher: false, userId: Guid.NewGuid()),
            new FakeConverter());

        var result = await controller.Preview(fileId, CancellationToken.None);

        var error = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, error.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(error.Value);
        Assert.Equal("Files.Forbidden", problem.Title);
    }

    private static FilesController NewController(IFileService files, ICurrentUser user, IDocumentToPdfConverter converter)
    {
        var controller = new FilesController(files, user, converter);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        return controller;
    }

    private sealed class FakeFileService(
        Guid id,
        string fileName,
        string contentType,
        MemoryStream content,
        FileVisibility visibility = FileVisibility.Authenticated,
        Guid? uploadedBy = null) : IFileService
    {
        public Task<Result<StoredFileDto>> UploadAsync(
            Stream content, string fileName, string contentType, long length,
            bool enforceStorageMode = true,
            FileVisibility visibility = FileVisibility.Authenticated,
            CancellationToken ct = default) =>
            Task.FromResult(Result.Failure<StoredFileDto>(Error.Failure("Test.NotUsed", "Không dùng trong test.")));

        public Task<Result<StoredFileInfo>> GetInfoAsync(Guid requestedId, CancellationToken ct = default)
        {
            if (requestedId != id)
                return Task.FromResult(Result.Failure<StoredFileInfo>(Error.NotFound("Files.NotFound", "Không tìm thấy file.")));

            return Task.FromResult<Result<StoredFileInfo>>(new StoredFileInfo(
                id, fileName, contentType, content.Length, "abc", visibility, uploadedBy));
        }

        public Task<Result<StoredFileDownload>> GetForDownloadAsync(Guid requestedId, CancellationToken ct = default)
        {
            content.Position = 0;
            return Task.FromResult<Result<StoredFileDownload>>(new StoredFileDownload(content, contentType, fileName));
        }
    }

    private sealed class FakeConverter(byte[]? pdf = null) : IDocumentToPdfConverter
    {
        public bool Called { get; private set; }

        public Task<Result<byte[]>> ToPdfAsync(Stream content, string fileName, CancellationToken ct = default)
        {
            Called = true;
            return Task.FromResult<Result<byte[]>>(pdf ?? [4, 5, 6]);
        }
    }

    private sealed class FakeCurrentUser(
        bool isAuthenticated,
        bool isTeacher,
        bool isAdmin = false,
        Guid? userId = null) : ICurrentUser
    {
        public Guid? UserId { get; } = userId ?? Guid.NewGuid();
        public string? Email => "test@hedu.local";
        public bool IsAuthenticated => isAuthenticated;
        public bool IsInRole(string role) => (isAdmin && role == AppRoles.Admin) || (isTeacher && role == AppRoles.Teacher);
    }
}
