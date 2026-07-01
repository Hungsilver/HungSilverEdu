using HungSilver.Domain.Enums;

namespace HungSilver.Application.Exams;

// ---------------- Học viên: danh sách đề được giao ----------------

public sealed record PortalExamDto(
    Guid AssignmentId, Guid ExamId, string ExamTitle, string ClassName, ExamDeliveryMode Mode,
    int DurationMinutes, DateTime OpenAt, DateTime? CloseAt, bool IsOpen,
    ExamAttemptStatus? AttemptStatus, Guid? AttemptId, decimal? Score, decimal TotalPoints);

// ---------------- Câu hỏi cho học viên (KHÔNG có đáp án/giải thích) ----------------

public sealed record PortalGroupDto(Guid Id, int OrderNo, string? Section, string? ExerciseLabel, string? Instruction, string? Passage);

public sealed record PortalQuestionDto(Guid Id, Guid? GroupId, int OrderNo, ExamQuestionType Type, string Stem, string? OptionsJson, decimal Points);

public sealed record PortalSavedAnswerDto(Guid QuestionId, string? ResponseJson);

public sealed record PortalAttemptDto(
    Guid AttemptId, Guid AssignmentId, string ExamTitle, int DurationMinutes, DateTime ExpiresAt, decimal TotalPoints,
    IReadOnlyList<PortalGroupDto> Groups, IReadOnlyList<PortalQuestionDto> Questions, IReadOnlyList<PortalSavedAnswerDto> SavedAnswers);

public sealed record SaveExamAnswerRequest(Guid QuestionId, string? ResponseJson);

public sealed record ExamAttemptResultDto(decimal Score, decimal TotalPoints, int CorrectCount, int TotalCount, ExamAttemptStatus Status);

// ---------------- Xem lại sau khi nộp (có đáp án + giải thích) ----------------

public sealed record PortalReviewQuestionDto(
    Guid Id, Guid? GroupId, int OrderNo, ExamQuestionType Type, string Stem, string? OptionsJson,
    string AnswerJson, string? Explanation, string? ResponseJson, bool? IsCorrect, decimal AwardedPoints, decimal Points);

public sealed record PortalReviewDto(
    string ExamTitle, decimal Score, decimal TotalPoints, int CorrectCount, int TotalCount, ExamAttemptStatus Status,
    IReadOnlyList<PortalGroupDto> Groups, IReadOnlyList<PortalReviewQuestionDto> Questions);
