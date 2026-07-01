using HungSilver.Domain.Enums;

namespace HungSilver.Application.Exams;

public sealed record ExamListItemDto(
    Guid Id, Guid? MaterialId, Guid? SubjectId, string? SubjectName, string Title, string? GradeBand,
    int DurationMinutes, decimal TotalPoints, ExamStatus Status, ExamGenSource Source, int QuestionCount, DateTime CreatedAt);

public sealed record ExamGroupDto(
    Guid Id, int OrderNo, string? Section, string? ExerciseLabel, string? Instruction, string? Passage);

/// <summary>Câu hỏi (bản GV — có kèm đáp án + giải thích). OptionsJson/AnswerJson là JSON theo loại.</summary>
public sealed record ExamQuestionDto(
    Guid Id, Guid? GroupId, int OrderNo, int? SourceNumber, ExamQuestionType Type, string Stem,
    string? OptionsJson, string AnswerJson, string? Explanation, decimal Points);

public sealed record ExamDetailDto(
    Guid Id, Guid? MaterialId, Guid? SubjectId, string? SubjectName, string Title, string? Description,
    string? GradeBand, int DurationMinutes, decimal TotalPoints, ExamStatus Status, ExamGenSource Source,
    string? SourceFileUrl,
    IReadOnlyList<ExamGroupDto> Groups, IReadOnlyList<ExamQuestionDto> Questions, DateTime CreatedAt);

public sealed record UpdateExamRequest(string Title, string? Description, string? GradeBand, int DurationMinutes);

/// <summary>Thêm/sửa 1 câu hỏi (GV nhập cấu trúc; server dựng lại OptionsJson/AnswerJson qua ExamQuestionFactory).</summary>
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
    string? Explanation,
    decimal? Points);
