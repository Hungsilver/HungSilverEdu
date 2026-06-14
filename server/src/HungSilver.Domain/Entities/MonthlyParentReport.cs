using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>Báo cáo phụ huynh theo tháng (Module 9).</summary>
public class MonthlyParentReport : BaseEntity
{
    public Guid StudentId { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public int SessionsAttended { get; set; }
    public int SessionsTotal { get; set; }
    public decimal HomeworkCompletionPercent { get; set; }
    public int RewardPoints { get; set; }
    public string? AssessmentText { get; set; }
    public string? Suggestion { get; set; }
    public string? GeneratedContent { get; set; }
}
