namespace HungSilver.Domain.Enums;

/// <summary>Phạm vi áp dụng của một cấu hình. Độ ưu tiên khi giải: User > Class > Role > System.</summary>
public enum SettingScope
{
    System = 0,  // Toàn hệ thống (Admin)
    Role = 1,    // Mặc định theo role
    Class = 2,   // Theo lớp (Teacher)
    User = 3     // Theo người dùng
}
