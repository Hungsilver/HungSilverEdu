using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Bài đánh giá năng lực học sinh với 6 kỹ năng (Module 3, 14).</summary>
public class StudentAssessment : BaseEntity
{
    public Guid StudentId { get; set; }
    public AssessmentType Type { get; set; }
    public DateOnly TakenOn { get; set; }
    public decimal? OverallScore { get; set; }

    // 6 kỹ năng
    public decimal? Vocabulary { get; set; }
    public decimal? Grammar { get; set; }
    public decimal? Listening { get; set; }
    public decimal? Speaking { get; set; }
    public decimal? Reading { get; set; }
    public decimal? Writing { get; set; }

    public string? Notes { get; set; }
}
