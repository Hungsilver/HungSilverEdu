using HungSilver.Domain.Enums;

namespace HungSilver.Application.Exams;

public sealed record ExamListItemDto(
    Guid Id, Guid? MaterialId, Guid? SubjectId, string? SubjectName, string Title, string? GradeBand,
    int DurationMinutes, decimal TotalPoints, ExamStatus Status, ExamGenSource Source, int QuestionCount,
    string? MaterialTitle, int AssignmentCount, string? CreatedByName, DateTime CreatedAt);

/// <summary>
/// Bộ lọc danh sách đề dùng chung cho màn "Đề &amp; Bài tập" (thay 2 hàm lọc rời theo môn/tài liệu).
/// <paramref name="AssignedOnly"/> = true chỉ lấy đề đang có lượt giao TRONG PHẠM VI lớp người dùng phụ trách.
/// </summary>
public sealed record ExamListFilter(
    Guid? SubjectId = null,
    Guid? MaterialId = null,
    string? GradeBand = null,
    ExamStatus? Status = null,
    string? Search = null,
    bool AssignedOnly = false);

public sealed record ExamGroupDto(
    Guid Id, int OrderNo, string? Section, string? ExerciseLabel, string? Instruction, string? Passage);

/// <summary>Câu hỏi (bản GV — có kèm đáp án + giải thích). OptionsJson/AnswerJson là JSON theo loại.</summary>
public sealed record ExamQuestionDto(
    Guid Id, Guid? GroupId, int OrderNo, int? SourceNumber, ExamQuestionType Type, string Stem,
    string? OptionsJson, string AnswerJson, string? Explanation, decimal Points);

/// <summary>
/// Chi tiết đề. <paramref name="MaterialTitle"/> = tài liệu đề gắn vào (chỗ đứng trong Kho);
/// <paramref name="QuestionSourceName"/> = tên file AI thực sự đã đọc để lấy câu hỏi, CHỈ có giá trị
/// khi khác file của tài liệu (chọn tài liệu khác trong bộ / tải file câu hỏi riêng) — để GV không nhầm.
/// </summary>
public sealed record ExamDetailDto(
    Guid Id, Guid? MaterialId, Guid? SubjectId, string? SubjectName, string Title, string? Description,
    string? GradeBand, int DurationMinutes, decimal TotalPoints, ExamStatus Status, ExamGenSource Source,
    string? SourceFileUrl, string? SourceFilePreviewUrl, string? MaterialTitle, string? QuestionSourceName,
    IReadOnlyList<ExamGroupDto> Groups, IReadOnlyList<ExamQuestionDto> Questions, string? CreatedByName, DateTime CreatedAt);

public sealed record UpdateExamRequest(string Title, string? Description, string? GradeBand, int DurationMinutes);

/// <summary>
/// Thêm/sửa 1 câu hỏi (GV nhập cấu trúc; server dựng lại OptionsJson/AnswerJson qua ExamQuestionFactory).
/// Không nhận điểm — điểm luôn do hệ thống chia đều trên tổng điểm đề (ExamPoints.Distribute).
/// </summary>
public sealed record UpsertQuestionRequest(
    Guid? GroupId,
    ExamQuestionType Type,
    string Stem,
    List<GenOption>? Options,
    List<GenOption>? OptionsRight,
    string? AnswerKey,
    List<string>? AnswerBlanks,
    List<string>? WordBox,
    List<GenPair>? AnswerPairs,
    string? Explanation);
