namespace HungSilver.Application.Exams;

/// <summary>Chế độ sinh đề: trích xuất đề có sẵn trong tài liệu, hay sinh câu hỏi mới theo nội dung.</summary>
public enum ExamGenerationMode
{
    Extract = 0,
    Generate = 1
}

/// <summary>Yêu cầu sinh đề từ 1 tài liệu (kho học liệu).</summary>
public sealed record GenerateExamRequest(
    ExamGenerationMode Mode,
    string? Title,
    int? DurationMinutes,
    int? MaxQuestions,        // Generate: số câu mong muốn; Extract: bỏ qua (lấy hết)
    string? Difficulty,       // Generate: dễ/trung bình/khó…
    string? Instructions,     // ghi chú thêm cho AI (tùy chọn)
    bool Verify = true);      // bật Lớp 2 (AI đối chiếu bản trích vs nguồn)

/// <summary>Kết quả sinh đề: id đề nháp + số câu + số câu bị bỏ + cảnh báo (cho GV rà).</summary>
public sealed record ExamGenerationResult(
    Guid ExamId,
    int QuestionCount,
    int DroppedCount,
    IReadOnlyList<string> Warnings);

// ----------------- DTO khớp JSON Gemini trả về (PropertyNameCaseInsensitive) -----------------

public sealed class GenExamPayload
{
    public List<GenGroup>? Groups { get; set; }
}

public sealed class GenGroup
{
    public string? ExerciseLabel { get; set; }
    public string? Section { get; set; }
    public string? Instruction { get; set; }
    public string? Passage { get; set; }
    public List<GenQuestion>? Questions { get; set; }
}

public sealed class GenQuestion
{
    public int? Number { get; set; }
    public string? Type { get; set; }
    public string? Stem { get; set; }
    public List<GenOption>? Options { get; set; }       // SingleChoice; Matching = cột TRÁI
    public List<GenOption>? OptionsRight { get; set; }  // Matching = cột PHẢI
    public string? AnswerKey { get; set; }              // SingleChoice (key) / TrueFalse ("true"/"false")
    public List<string>? AnswerBlanks { get; set; }     // FillBlank: mỗi phần tử = "ans1/ans2" (accept-list)
    public List<string>? WordBox { get; set; }          // FillBlank: hộp từ (tùy chọn)
    public List<GenPair>? AnswerPairs { get; set; }     // Matching: cặp left→right
    public string? Explanation { get; set; }
}

public sealed class GenOption
{
    public string? Key { get; set; }
    public string? Text { get; set; }
}

public sealed class GenPair
{
    public string? Left { get; set; }
    public string? Right { get; set; }
}
