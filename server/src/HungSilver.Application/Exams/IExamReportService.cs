using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Exams;

/// <summary>Báo cáo kết quả một lượt giao đề cho GV (per-student, TB lớp, phân bố điểm, item analysis).</summary>
public interface IExamReportService
{
    Task<Result<ExamReportDto>> GetReportAsync(Guid assignmentId, CancellationToken ct = default);
    /// <summary>GV xem bài làm một học viên đã nộp (đáp án + bài làm + điểm từng câu).</summary>
    Task<Result<TeacherAttemptReviewDto>> GetAttemptReviewAsync(Guid attemptId, CancellationToken ct = default);
}
