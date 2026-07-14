using HungSilver.Domain.Enums;

namespace HungSilver.Application.Exams;

/// <summary>Một cột trong biểu đồ phân bố điểm (vd "0–2": 3 học viên).</summary>
public sealed record ExamScoreBucketDto(string Label, int Count);

/// <summary>Thống kê từng câu (item analysis): % học viên trả lời đúng.</summary>
public sealed record ExamItemStatDto(
    Guid QuestionId, int OrderNo, int? SourceNumber, ExamQuestionType Type,
    int CorrectCount, int AnsweredCount, double CorrectPercent);

/// <summary>Kết quả của một học viên trong lượt giao đề. AttemptId dùng để GV mở trang xem bài làm.
/// IsActive=false: HS đã rời lớp sau khi có bài làm — vẫn hiện để số liệu báo cáo khớp bảng.</summary>
public sealed record ExamStudentResultDto(
    Guid StudentId, string FullName, Guid? AttemptId, ExamAttemptStatus? Status, decimal? Score, DateTime? SubmittedAt,
    bool IsActive);

/// <summary>GV xem bài làm một học viên: bọc PortalReviewDto (đáp án + bài làm + điểm từng câu) kèm định danh HS.</summary>
public sealed record TeacherAttemptReviewDto(
    Guid AttemptId, Guid AssignmentId, Guid StudentId, string StudentName, PortalReviewDto Review);

/// <summary>Báo cáo trực quan cho GV về một lượt giao đề.</summary>
public sealed record ExamReportDto(
    Guid AssignmentId, string ExamTitle, string ClassName, decimal TotalPoints,
    int TotalStudents, int SubmittedCount, decimal? AverageScore,
    IReadOnlyList<ExamScoreBucketDto> Distribution,
    IReadOnlyList<ExamItemStatDto> ItemStats,
    IReadOnlyList<ExamStudentResultDto> Students);
