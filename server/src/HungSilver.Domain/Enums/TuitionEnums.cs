namespace HungSilver.Domain.Enums;

/// <summary>Trạng thái học phí.</summary>
public enum TuitionStatus
{
    Pending = 0,   // Chưa tới hạn
    Paid = 1,      // Đã đóng
    DueSoon = 2,   // Sắp đến hạn
    Overdue = 3    // Quá hạn
}
