using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Evaluations;

public interface IEvaluationService
{
    Task<Result<List<MonthlyEvaluationDto>>> GetByClassMonthAsync(Guid classId, int year, int month, CancellationToken ct = default);
    Task<Result<List<MonthlyEvaluationDto>>> GetByStudentAsync(Guid studentId, CancellationToken ct = default);
    Task<Result<MonthlyEvaluationDto>> UpsertAsync(UpsertEvaluationRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);

    /// <summary>Bảng vàng theo tuần gần nhất (tuỳ chọn lọc theo lớp).</summary>
    Task<Result<LeaderboardDto>> GetLeaderboardAsync(Guid? classId, CancellationToken ct = default);
}
