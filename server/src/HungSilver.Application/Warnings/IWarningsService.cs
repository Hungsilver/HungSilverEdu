using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Warnings;

public sealed record WarningItem(Guid StudentId, string StudentName, string Detail);

public sealed record WarningsDto(
    IReadOnlyList<WarningItem> ConsecutiveAbsences,
    IReadOnlyList<WarningItem> MissedHomework,
    IReadOnlyList<WarningItem> ScoreDrop,
    IReadOnlyList<WarningItem> TuitionOverdue);

public interface IWarningsService
{
    /// <summary>Tổng hợp cảnh báo cho phạm vi (Admin = toàn TT; Teacher = lớp của mình; hoặc 1 lớp; hoặc 1 học sinh).</summary>
    Task<Result<WarningsDto>> GetWarningsAsync(Guid? classId, Guid? studentId = null, CancellationToken ct = default);
}
