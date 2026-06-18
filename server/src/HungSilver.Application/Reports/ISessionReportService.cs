using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.Reports;

public sealed record GeneratedReportDto(Guid? Id, ReportType Type, string Content, DateTime GeneratedAt);

public interface ISessionReportService
{
    /// <summary>Sinh nội dung "Thông báo buổi học", lưu lại và trả về để xem trước/copy/gửi.</summary>
    Task<Result<GeneratedReportDto>> GenerateSessionNoticeAsync(Guid sessionId, CancellationToken ct = default);

    /// <summary>Sinh "Thông báo lịch học" cho buổi học gần nhất sắp tới của lớp.</summary>
    Task<Result<GeneratedReportDto>> GenerateScheduleNoticeAsync(Guid classId, CancellationToken ct = default);
}
