using HungSilver.Application.Common.Models;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.Exams;

/// <summary>GV giao đề (đã phát hành) cho lớp + xem/đóng lượt giao.</summary>
public interface IExamAssignmentService
{
    Task<Result<ExamAssignmentDto>> AssignAsync(Guid examId, AssignExamRequest request, CancellationToken ct = default);
    Task<Result<List<ExamAssignmentDto>>> ListByExamAsync(Guid examId, CancellationToken ct = default);
    /// <summary>
    /// Mọi lượt giao trong phạm vi người dùng (tab "Đã giao cho lớp"): Admin thấy tất cả,
    /// GV chỉ thấy lượt giao của lớp mình phụ trách. Lọc theo lớp/trạng thái + tìm theo tên đề.
    /// </summary>
    Task<Result<PagedResult<ExamAssignmentDto>>> GetPagedAsync(
        Guid? classId, ExamAssignmentStatus? status, PagedRequest paging, CancellationToken ct = default);
    /// <summary>Các lượt giao gắn với một buổi học (section Bài tập trong màn hình buổi học).</summary>
    Task<Result<List<ExamAssignmentDto>>> ListBySessionAsync(Guid sessionId, CancellationToken ct = default);
    /// <summary>Mọi lượt giao của một lớp (section Bài tập trong trang chi tiết lớp).</summary>
    Task<Result<List<ExamAssignmentDto>>> ListByClassAsync(Guid classId, CancellationToken ct = default);
    /// <summary>Bài tập về nhà của một học viên, tùy chọn lọc theo lớp.</summary>
    Task<Result<List<StudentHomeworkDto>>> ListStudentHomeworkAsync(Guid studentId, Guid? classId = null, CancellationToken ct = default);
    Task<Result> CloseAsync(Guid assignmentId, CancellationToken ct = default);
}
