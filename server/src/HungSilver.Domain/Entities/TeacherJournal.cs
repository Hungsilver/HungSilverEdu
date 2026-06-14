using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>Nhật ký giáo viên cho 1 buổi học (Module 7) — quan hệ 1:1 với ClassSession.</summary>
public class TeacherJournal : BaseEntity
{
    public Guid ClassSessionId { get; set; }
    public string? ContentTaught { get; set; }
    public string? Activities { get; set; }
    public string? Difficulties { get; set; }
    public string? NotesForNextSession { get; set; }
}
