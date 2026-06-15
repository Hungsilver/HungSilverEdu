using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.Assignments;

public sealed record AssignmentDto(
    Guid Id,
    Guid ClassId,
    Guid? ClassSessionId,
    Guid? MaterialId,
    string? MaterialTitle,
    string Title,
    string? Instructions,
    DateOnly? DueDate,
    int SubmittedCount,
    int TotalCount,
    DateTime CreatedAtUtc);

public sealed record CreateAssignmentRequest(
    Guid ClassId,
    Guid? ClassSessionId,
    Guid? MaterialId,
    string Title,
    string? Instructions,
    DateOnly? DueDate);

public sealed record SubmissionStatusDto(
    Guid StudentId,
    string FullName,
    SubmissionStatus Status,
    DateOnly? SubmittedOn,
    string? Link,
    string? Note);

public sealed record SetSubmissionStatusRequest(SubmissionStatus Status);

public interface IAssignmentService
{
    Task<Result<List<AssignmentDto>>> GetByClassAsync(Guid classId, CancellationToken ct = default);
    Task<Result<List<AssignmentDto>>> GetBySessionAsync(Guid sessionId, CancellationToken ct = default);
    Task<Result<AssignmentDto>> CreateAsync(CreateAssignmentRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<Result<List<SubmissionStatusDto>>> GetSubmissionsAsync(Guid assignmentId, CancellationToken ct = default);
    Task<Result> SetStatusAsync(Guid assignmentId, Guid studentId, SetSubmissionStatusRequest request, CancellationToken ct = default);
}
