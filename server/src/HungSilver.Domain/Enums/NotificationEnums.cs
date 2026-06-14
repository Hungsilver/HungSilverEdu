namespace HungSilver.Domain.Enums;

/// <summary>Loại nội dung thông báo.</summary>
public enum NotificationType
{
    Schedule = 0,  // Lịch học
    DayOff = 1,    // Nghỉ học
    Report = 2,    // Báo cáo
    Tuition = 3,   // Học phí
    Homework = 4   // Bài tập
}

/// <summary>Kênh gửi thông báo.</summary>
public enum NotificationChannel
{
    Email = 0,
    Zalo = 1,
    Messenger = 2
}

/// <summary>Trạng thái gửi từng bản thông báo.</summary>
public enum NotificationDeliveryStatus
{
    Pending = 0,  // Chờ gửi
    Sent = 1,     // Đã gửi
    Failed = 2,   // Gửi lỗi
    Manual = 3    // Tạo nội dung để gửi thủ công (Zalo/Messenger)
}
