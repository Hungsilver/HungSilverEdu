using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Students;

public sealed record StudentImportRowDto(
    int RowNumber,
    string? FullName,
    string? DateOfBirth,
    string? School,
    string? Phone,
    string? ParentName,
    string? ParentPhone,
    string? EnglishLevel,
    string? LearningGoal,
    bool IsValid,
    string? Error);

public sealed record StudentImportPreviewDto(
    IReadOnlyList<StudentImportRowDto> Rows,
    int ValidCount,
    int InvalidCount);

public sealed record StudentImportResultDto(
    int Created,
    int AccountsCreated,
    int Skipped,
    IReadOnlyList<string> Errors);

/// <summary>Nhập danh sách học viên vào 1 lớp từ file Excel (Đợt 6).</summary>
public interface IStudentImportService
{
    Task<Result<StudentImportPreviewDto>> PreviewAsync(Guid classId, Stream file, CancellationToken ct = default);
    Task<Result<StudentImportResultDto>> CommitAsync(Guid classId, Stream file, bool createAccounts, CancellationToken ct = default);
    byte[] BuildTemplate();
}
