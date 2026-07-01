namespace HungSilver.Domain.Enums;

/// <summary>Trạng thái đề: nháp (đang duyệt) hay đã phát hành vào bộ đề.</summary>
public enum ExamStatus
{
    Draft = 0,
    Published = 1
}

/// <summary>Nguồn gốc đề: trích từ tài liệu, AI sinh mới, hay tạo tay.</summary>
public enum ExamGenSource
{
    Extracted = 0,
    Generated = 1,
    Manual = 2
}

/// <summary>Loại câu hỏi trắc nghiệm tự chấm (đợt này chỉ 4 loại).</summary>
public enum ExamQuestionType
{
    SingleChoice = 0,  // 1 đáp án (A–D hoặc 2 lựa chọn)
    TrueFalse = 1,     // Đúng/Sai
    FillBlank = 2,     // Điền từ (có hộp từ + danh sách đáp án chấp nhận)
    Matching = 3       // Nối cột A–B
}
