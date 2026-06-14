namespace HungSilver.Domain.Enums;

/// <summary>Loại bài đánh giá năng lực học sinh.</summary>
public enum AssessmentType
{
    Entry = 0,      // Điểm đầu vào
    Periodic = 1,   // Kiểm tra định kỳ
    Final = 2       // Điểm cuối khóa
}

/// <summary>Xếp hạng đánh giá hàng tháng.</summary>
public enum EvaluationRank
{
    Excellent = 0,        // Xuất sắc
    Good = 1,             // Tốt
    Satisfactory = 2,     // Đạt yêu cầu
    NeedsImprovement = 3  // Cần cố gắng
}
