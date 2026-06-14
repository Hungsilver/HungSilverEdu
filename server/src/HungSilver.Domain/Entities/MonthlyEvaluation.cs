using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Đánh giá học sinh theo tháng với 5 tiêu chí /10 (Module 12).</summary>
public class MonthlyEvaluation : BaseEntity
{
    public Guid StudentId { get; set; }
    public Guid? ClassId { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }

    public decimal AttendanceScore { get; set; }   // Chuyên cần /10
    public decimal HomeworkScore { get; set; }      // Bài tập /10
    public decimal AttitudeScore { get; set; }      // Thái độ /10
    public decimal VocabularyScore { get; set; }    // Từ vựng /10
    public decimal GrammarScore { get; set; }       // Ngữ pháp /10

    public EvaluationRank Rank { get; set; }
    public string? Comment { get; set; }
}
