using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Exams;

/// <summary>Báo cáo kết quả một lượt giao đề cho GV (per-student, TB lớp, phân bố điểm, item analysis).</summary>
public interface IExamReportService
{
    Task<Result<ExamReportDto>> GetReportAsync(Guid assignmentId, CancellationToken ct = default);
}
