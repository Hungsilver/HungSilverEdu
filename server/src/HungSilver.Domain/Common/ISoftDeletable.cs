namespace HungSilver.Domain.Common;

/// <summary>
/// Entity được đánh dấu xóa mềm: không bao giờ xóa vật lý khỏi database.
/// AppDbContext tự gắn global query filter cho mọi entity implement interface này.
/// </summary>
public interface ISoftDeletable
{
    bool IsDeleted { get; set; }
    DateTime? DeletedAtUtc { get; set; }
}
