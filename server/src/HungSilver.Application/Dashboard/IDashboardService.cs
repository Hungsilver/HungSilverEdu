using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Dashboard;

public interface IDashboardService
{
    /// <summary>Số liệu tổng quan (Admin/Teacher = toàn trung tâm).</summary>
    Task<Result<DashboardSummaryDto>> GetSummaryAsync(CancellationToken ct = default);

    Task<Result<DashboardChartsDto>> GetChartsAsync(CancellationToken ct = default);
}
