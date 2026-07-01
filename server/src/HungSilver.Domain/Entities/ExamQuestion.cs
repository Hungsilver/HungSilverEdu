using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Một câu hỏi trắc nghiệm trong đề. Lựa chọn/đáp án lưu JSON. Không khóa ngoại.</summary>
public class ExamQuestion : BaseEntity
{
    public Guid ExamId { get; set; }

    /// <summary>Nhóm ngữ liệu chung (tùy chọn).</summary>
    public Guid? GroupId { get; set; }

    public int OrderNo { get; set; }

    /// <summary>Số thứ tự gốc trong tài liệu (phục vụ kiểm chứng đủ câu).</summary>
    public int? SourceNumber { get; set; }

    public ExamQuestionType Type { get; set; }

    public string Stem { get; set; } = string.Empty;

    /// <summary>
    /// Lựa chọn (JSON tùy loại): SingleChoice <c>[{key,text}]</c>; Matching <c>{left,right}</c>;
    /// FillBlank <c>{blanks,wordBox}</c>; TrueFalse = null.
    /// </summary>
    public string? OptionsJson { get; set; }

    /// <summary>Đáp án đúng (JSON tùy loại): <c>{key}</c> / <c>{value}</c> / <c>{blanks}</c> / <c>{pairs}</c>.</summary>
    public string AnswerJson { get; set; } = string.Empty;

    /// <summary>Giải thích vì sao đúng (tiếng Việt) — chỉ hiện cho học viên sau khi nộp.</summary>
    public string? Explanation { get; set; }

    /// <summary>Điểm của câu (tổng các câu = <see cref="Exam.TotalPoints"/>).</summary>
    public decimal Points { get; set; }
}
