using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Buổi học cụ thể (Module 5, 6) — entity dùng nhiều nhất.</summary>
public class ClassSession : BaseEntity
{
    public Guid ClassId { get; set; }
    public int SessionNumber { get; set; }
    public DateOnly SessionDate { get; set; }
    public TimeOnly? StartTime { get; set; }
    public TimeOnly? EndTime { get; set; }
    public string? Topic { get; set; }
    public SessionStatus Status { get; set; } = SessionStatus.Scheduled;
}
