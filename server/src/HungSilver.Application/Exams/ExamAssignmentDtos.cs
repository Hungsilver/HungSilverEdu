using HungSilver.Domain.Enums;

namespace HungSilver.Application.Exams;

/// <summary>
/// GV giao đề cho lớp (tùy chọn gắn buổi học), hẹn giờ.
/// DurationMinutes null/0 = lấy thời lượng từ đề; NoTimeLimit = không giới hạn giờ làm (chỉ bài về nhà, bắt buộc CloseAt).
/// </summary>
public sealed record AssignExamRequest(
    Guid ClassId, Guid? ClassSessionId, ExamDeliveryMode Mode, int? DurationMinutes, DateTime OpenAt, DateTime? CloseAt,
    bool NoTimeLimit = false);

public sealed record ExamAssignmentDto(
    Guid Id, Guid ExamId, string? ExamTitle, Guid ClassId, string ClassName, Guid? ClassSessionId,
    ExamDeliveryMode Mode, int? DurationMinutes, DateTime OpenAt, DateTime? CloseAt, ExamAssignmentStatus Status,
    int TotalStudents, int SubmittedCount, DateTime CreatedAt);
