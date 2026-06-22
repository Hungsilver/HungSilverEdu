using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Classes;

public interface IClassImportService
{
    byte[] BuildTemplate();
    Task<Result<ClassImportPreviewDto>> PreviewAsync(Stream file, CancellationToken ct = default);
    Task<Result<ClassImportResultDto>> CommitAsync(ClassImportCommitRequest request, CancellationToken ct = default);
}

public sealed record ClassImportClassPreviewDto(
    string PreviewId,
    string? ClassCode,
    string Name,
    Guid? ExistingClassId,
    Guid? BranchId,
    string? BranchCode,
    string? BranchName,
    Guid? SubjectId,
    string? SubjectName,
    Guid? GradeId,
    string? GradeName,
    Guid? TeacherProfileId,
    string? TeacherName,
    decimal TuitionFee,
    bool IsValid,
    string? Error);

public sealed record ClassImportStudentPreviewDto(
    int RowNumber,
    string PreviewClassId,
    string? StudentCode,
    string FullName,
    string? DateOfBirth,
    string? ParentPhone,
    string? Phone,
    string? Note,
    bool IsValid,
    string? Error);

public sealed record ClassImportPreviewDto(
    IReadOnlyList<ClassImportClassPreviewDto> Classes,
    IReadOnlyList<ClassImportStudentPreviewDto> Students,
    int ValidClassCount,
    int ValidStudentCount,
    int InvalidCount);

public sealed record ClassImportCommitRequest(
    IReadOnlyList<ClassImportClassPreviewDto> Classes,
    IReadOnlyList<ClassImportStudentPreviewDto> Students);

public sealed record ClassImportResultDto(
    int ClassesCreated,
    int StudentsCreated,
    int EnrollmentsCreated,
    int Skipped,
    IReadOnlyList<string> Errors);
