using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Exams;

/// <summary>GV giao đề (đã phát hành) cho lớp + xem/đóng lượt giao.</summary>
public interface IExamAssignmentService
{
    Task<Result<ExamAssignmentDto>> AssignAsync(Guid examId, AssignExamRequest request, CancellationToken ct = default);
    Task<Result<List<ExamAssignmentDto>>> ListByExamAsync(Guid examId, CancellationToken ct = default);
    Task<Result> CloseAsync(Guid assignmentId, CancellationToken ct = default);
}
