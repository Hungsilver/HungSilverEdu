using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Báo cáo tự động sinh cho buổi học (Module 8).</summary>
public class SessionReport : BaseEntity
{
    public Guid ClassSessionId { get; set; }
    public ReportType Type { get; set; }
    public string GeneratedContent { get; set; } = string.Empty;
    public DateTime GeneratedAt { get; set; }
}
