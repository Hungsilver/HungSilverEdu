using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Bản ghi của 1 học sinh trong 1 buổi học (Module 6 - Phần 1,2,3,6).</summary>
public class StudentSessionRecord : BaseEntity
{
    public Guid ClassSessionId { get; set; }
    public Guid StudentId { get; set; }
    public AttendanceStatus Attendance { get; set; } = AttendanceStatus.Present;
    public HomeworkStatus Homework { get; set; } = HomeworkStatus.NotAssigned;
    public AttitudeStatus Attitude { get; set; } = AttitudeStatus.Normal;
    public string? PersonalNote { get; set; }
}
