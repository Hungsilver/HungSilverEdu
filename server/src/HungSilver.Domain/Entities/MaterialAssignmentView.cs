using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>Ghi nhận lần ĐẦU học viên mở một tài liệu được giao (để GV biết ai đã xem). Không khóa ngoại.</summary>
public class MaterialAssignmentView : BaseEntity
{
    public Guid MaterialAssignmentId { get; set; }
    public Guid StudentId { get; set; }
    public DateTime ViewedAt { get; set; }
}
