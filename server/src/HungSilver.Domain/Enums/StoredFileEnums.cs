namespace HungSilver.Domain.Enums;

/// <summary>Mức truy cập file đã lưu (phân tầng theo độ nhạy cảm).</summary>
public enum FileVisibility
{
    Public = 0,        // Ai cũng tải được qua link GUID — ảnh đại diện, ảnh công khai (thẻ <img>)
    Authenticated = 1, // Phải đăng nhập mới tải — học liệu chia sẻ trong hệ thống
    Restricted = 2     // Chỉ người upload hoặc Teacher/Admin — tài liệu nhạy cảm
}
