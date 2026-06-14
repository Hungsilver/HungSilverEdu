using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Common;

/// <summary>
/// Kiểm soát quyền theo dòng dữ liệu: Admin truy cập mọi lớp; Teacher chỉ lớp do mình phụ trách.
/// </summary>
public interface IClassAccessGuard
{
    /// <summary>Trả Success nếu được phép, Forbidden/NotFound nếu không.</summary>
    Task<Result> EnsureCanAccessClassAsync(Guid classId, CancellationToken ct = default);

    Task<bool> CanAccessClassAsync(Guid classId, CancellationToken ct = default);

    /// <summary>Teacher chỉ truy cập được học sinh có ghi danh đang hiệu lực ở lớp của mình.</summary>
    Task<Result> EnsureCanAccessStudentAsync(Guid studentId, CancellationToken ct = default);

    /// <summary>Id giáo viên hiện tại nếu user là Teacher (không phải Admin); null nếu Admin.</summary>
    Guid? TeacherScopeId { get; }

    bool IsAdmin { get; }
}
