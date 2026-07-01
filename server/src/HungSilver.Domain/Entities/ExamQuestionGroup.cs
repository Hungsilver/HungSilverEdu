using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>Nhóm câu hỏi dùng chung ngữ liệu (đoạn đọc/hội thoại/hộp từ/đề bài chung). Không khóa ngoại.</summary>
public class ExamQuestionGroup : BaseEntity
{
    public Guid ExamId { get; set; }
    public int OrderNo { get; set; }

    /// <summary>Phần đề (vd PHONETIC, READING…). Tùy chọn.</summary>
    public string? Section { get; set; }

    /// <summary>Nhãn bài tập gốc trong tài liệu (vd "Exercise 17"). Tùy chọn.</summary>
    public string? ExerciseLabel { get; set; }

    /// <summary>Câu lệnh/đề bài chung của nhóm. Tùy chọn.</summary>
    public string? Instruction { get; set; }

    /// <summary>Ngữ liệu chung (đoạn đọc/hội thoại/hộp từ). Tùy chọn.</summary>
    public string? Passage { get; set; }
}
