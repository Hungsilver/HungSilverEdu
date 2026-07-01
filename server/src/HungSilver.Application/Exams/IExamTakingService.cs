using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Exams;

/// <summary>Luồng làm bài của học viên: xem đề được giao, bắt đầu (hẹn giờ), lưu tạm, nộp (tự chấm), xem lại.</summary>
public interface IExamTakingService
{
    Task<Result<List<PortalExamDto>>> GetMyExamsAsync(CancellationToken ct = default);
    Task<Result<PortalAttemptDto>> StartAsync(Guid assignmentId, CancellationToken ct = default);
    Task<Result> SaveAnswerAsync(Guid attemptId, SaveExamAnswerRequest request, CancellationToken ct = default);
    Task<Result<ExamAttemptResultDto>> SubmitAsync(Guid attemptId, CancellationToken ct = default);
    Task<Result<PortalReviewDto>> GetReviewAsync(Guid attemptId, CancellationToken ct = default);
}
