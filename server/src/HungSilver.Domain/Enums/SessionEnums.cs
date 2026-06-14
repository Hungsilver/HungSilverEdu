namespace HungSilver.Domain.Enums;

/// <summary>Phần 1 - Điểm danh buổi học.</summary>
public enum AttendanceStatus
{
    Present = 0,            // Có mặt
    ExcusedAbsence = 1,     // Vắng có phép
    UnexcusedAbsence = 2,   // Vắng không phép
    Late = 3               // Đi muộn
}

/// <summary>Phần 2 - Bài tập về nhà.</summary>
public enum HomeworkStatus
{
    NotAssigned = 0,    // Không giao
    CompletedWell = 1,  // Hoàn thành tốt
    Completed = 2,      // Hoàn thành
    NotCompleted = 3    // Chưa hoàn thành
}

/// <summary>Phần 3 - Thái độ học tập.</summary>
public enum AttitudeStatus
{
    Positive = 0,   // Tích cực
    Normal = 1,     // Bình thường
    Unfocused = 2   // Chưa tập trung
}

/// <summary>Trạng thái buổi học.</summary>
public enum SessionStatus
{
    Scheduled = 0,  // Đã lên lịch
    Completed = 1,  // Đã hoàn thành
    Cancelled = 2   // Đã hủy
}
