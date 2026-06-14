using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>Khung giờ lặp theo tuần của lớp (Module 5) — nguồn để sinh ClassSession.</summary>
public class ClassScheduleSlot : BaseEntity
{
    public Guid ClassId { get; set; }
    public DayOfWeek DayOfWeek { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
}
