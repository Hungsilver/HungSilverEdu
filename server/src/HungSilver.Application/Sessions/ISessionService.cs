using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Sessions;

public interface ISessionService
{
    /// <summary>Ma trận điểm danh của buổi học: mỗi học sinh enrolled + bản ghi + điểm buổi + số dư điểm thưởng.</summary>
    Task<Result<SessionSheetDto>> GetSessionSheetAsync(Guid sessionId, CancellationToken ct = default);

    /// <summary>Lưu hàng loạt điểm danh/BTVN/thái độ/ghi chú (upsert theo từng học sinh).</summary>
    Task<Result> SaveAttendanceAsync(Guid sessionId, SaveAttendanceRequest request, CancellationToken ct = default);

    Task<Result<PointEntryDto>> AddPointAsync(Guid sessionId, AddPointRequest request, CancellationToken ct = default);
    Task<Result> RemovePointAsync(Guid entryId, CancellationToken ct = default);

    Task<Result<StudentProgressDto>> GetStudentProgressAsync(Guid studentId, CancellationToken ct = default);
    Task<Result> RedeemRewardAsync(Guid studentId, RedeemRewardRequest request, CancellationToken ct = default);
}
