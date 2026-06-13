namespace HungSilver.Domain.Common;

/// <summary>
/// Base cho mọi entity nghiệp vụ: khóa chính Guid, audit timestamps và soft delete.
/// </summary>
public abstract class BaseEntity : IAuditable, ISoftDeletable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAtUtc { get; set; }
}
