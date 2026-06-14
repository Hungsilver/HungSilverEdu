using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Reports;

public sealed record ParentReportDto(Guid? Id, int Year, int Month, string Content, DateTime GeneratedAtUtc);

public interface IParentReportService
{
    /// <summary>Sinh báo cáo phụ huynh theo tháng cho 1 học sinh (lưu lại + trả nội dung để copy/gửi).</summary>
    Task<Result<ParentReportDto>> GenerateAsync(Guid studentId, int year, int month, CancellationToken ct = default);
}
