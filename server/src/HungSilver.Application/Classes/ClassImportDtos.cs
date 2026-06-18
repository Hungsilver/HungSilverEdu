using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Classes;

/// <summary>Nhập danh sách LỚP từ Excel (Đợt 7) — song song với nhập học viên.</summary>
public interface IClassImportService
{
    byte[] BuildTemplate();
    Task<Result<ClassImportPreviewDto>> PreviewAsync(Stream file, CancellationToken ct = default);
    Task<Result<ClassImportResultDto>> CommitAsync(Stream file, CancellationToken ct = default);
}

public sealed record ClassImportRowDto(
    int RowNumber,
    string Name,
    string? SubjectName,
    string? GradeBand,
    string? Teacher,
    string? MaxCapacity,
    string? StartDate,
    string? Curriculum,
    bool IsValid,
    string? Error);

public sealed record ClassImportPreviewDto(
    IReadOnlyList<ClassImportRowDto> Rows,
    int ValidCount,
    int InvalidCount);

public sealed record ClassImportResultDto(
    int Created,
    int Skipped,
    IReadOnlyList<string> Errors);
