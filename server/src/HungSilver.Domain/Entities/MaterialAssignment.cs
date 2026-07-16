using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>Giao một tài liệu trong Kho cho một lớp (tùy chọn gắn buổi học) để học viên xem. Không khóa ngoại.</summary>
public class MaterialAssignment : BaseEntity
{
    public Guid MaterialId { get; set; }

    /// <summary>Snapshot tên tài liệu — chỉ dùng fallback hiển thị khi tài liệu đã bị xóa khỏi Kho.</summary>
    public string? MaterialTitle { get; set; }

    public Guid ClassId { get; set; }

    /// <summary>Buổi học gắn tài liệu (tùy chọn).</summary>
    public Guid? ClassSessionId { get; set; }

    /// <summary>Ghi chú/căn dặn của giáo viên cho học viên.</summary>
    public string? Note { get; set; }

    public Guid? AssignedByUserId { get; set; }
}
