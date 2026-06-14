using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>Ghi danh học sinh vào lớp (bảng nối Student ↔ Class, Module 4).</summary>
public class Enrollment : BaseEntity
{
    public Guid StudentId { get; set; }
    public Guid ClassId { get; set; }
    public DateOnly EnrolledOn { get; set; }
    public DateOnly? WithdrawnOn { get; set; }
    public bool IsActive { get; set; } = true;
}
