namespace HungSilver.Domain.Enums;

/// <summary>Phạm vi áp dụng của một cấu hình. Độ ưu tiên khi giải: User > Class > Role > System.</summary>
public enum SettingScope
{
    System = 0,  // Toàn hệ thống (Admin)
    Role = 1,    // Mặc định theo role
    Class = 2,   // Theo lớp (Teacher)
    User = 3     // Theo người dùng
}

/// <summary>Chế độ lưu file: upload lên server hay chỉ lưu link ngoài. Do Admin cấu hình.</summary>
public enum FileStorageMode
{
    ExternalUrl = 0,  // Chỉ lưu link/URL ngoài
    Server = 1        // Upload trực tiếp lên server
}
