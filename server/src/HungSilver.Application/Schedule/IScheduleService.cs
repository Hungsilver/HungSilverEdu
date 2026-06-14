using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Schedule;

public interface IScheduleService
{
    /// <summary>Buổi học trong khoảng ngày (dùng cho lịch tháng/tuần). Tự lọc theo lớp của giáo viên.</summary>
    Task<Result<List<CalendarSessionDto>>> GetRangeAsync(DateOnly from, DateOnly to, Guid? classId, CancellationToken ct = default);

    Task<Result<List<ScheduleSlotDto>>> GetSlotsAsync(Guid classId, CancellationToken ct = default);
    Task<Result<ScheduleSlotDto>> AddSlotAsync(CreateSlotRequest request, CancellationToken ct = default);
    Task<Result> RemoveSlotAsync(Guid slotId, CancellationToken ct = default);

    /// <summary>Sinh ClassSession từ khung giờ lặp tuần cho khoảng ngày (bỏ qua buổi đã có). Trả số buổi tạo mới.</summary>
    Task<Result<int>> GenerateSessionsAsync(Guid classId, GenerateSessionsRequest request, CancellationToken ct = default);

    Task<Result<CalendarSessionDto>> CreateSessionAsync(CreateSessionRequest request, CancellationToken ct = default);
    Task<Result> CancelSessionAsync(Guid sessionId, CancellationToken ct = default);
}
