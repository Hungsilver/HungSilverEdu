namespace HungSilver.Application.Settings;

/// <summary>Khóa cấu hình hệ thống dùng chung + giá trị mặc định.</summary>
public static class SettingKeys
{
    /// <summary>Chế độ lưu file: "Server" hoặc "ExternalUrl" (Admin cấu hình).</summary>
    public const string FileStorageMode = "FileStorage.Mode";

    /// <summary>Số ngày trước hạn để coi là "sắp đến hạn" học phí.</summary>
    public const string TuitionDueSoonDays = "Tuition.DueSoonDays";

    /// <summary>Ngưỡng điểm giảm để cảnh báo "giảm mạnh".</summary>
    public const string WarningScoreDropThreshold = "Warning.ScoreDropThreshold";

    /// <summary>
    /// Prefix FALLBACK sinh mã giáo viên khi GV chưa gắn cơ sở chính. Mặc định "HV".
    /// Khi GV có cơ sở, prefix lấy theo cơ sở (Branch.TeacherCodePrefix; trống → tên cơ sở + "@").
    /// </summary>
    public const string CenterCodePrefix = "Center.CodePrefix";

    /// <summary>Mật khẩu mặc định khi cấp/đặt lại tài khoản (HS &amp; GV). Phải đạt chính sách Identity
    /// (≥8 ký tự, có chữ hoa/thường/số). Người dùng vẫn bị buộc đổi ở lần đăng nhập đầu.</summary>
    public const string AccountDefaultPassword = "Account.DefaultPassword";

    /// <summary>Tên miền email "ảo" cho tài khoản không có email thật (Identity bắt buộc email duy nhất).</summary>
    public const string AccountLocalEmailDomain = "Account.LocalEmailDomain";

    /// <summary>
    /// Khung "Ca" học (để nhóm lịch theo Ca). JSON: <c>{ "default": [{name,from,to}], "byBranch": { "&lt;branchId&gt;": [...] } }</c>.
    /// Mỗi buổi xếp vào Ca theo giờ bắt đầu; cơ sở có override riêng dùng <c>byBranch</c>, còn lại dùng <c>default</c>.
    /// Giờ dạng "HH:mm". Cấu hình ở màn Cấu hình hệ thống (Admin).
    /// </summary>
    public const string ScheduleShifts = "Schedule.Shifts";

    /// <summary>JSON Ca mặc định (5 ca: 2 sáng, 2 chiều, 1 tối) — fallback khi chưa cấu hình.</summary>
    public const string DefaultShiftsJson = """
        {"default":[{"name":"Ca 1 sáng","from":"07:00","to":"09:00"},{"name":"Ca 2 sáng","from":"09:00","to":"11:30"},{"name":"Ca 1 chiều","from":"13:30","to":"15:30"},{"name":"Ca 2 chiều","from":"15:30","to":"17:30"},{"name":"Ca tối","from":"18:00","to":"21:00"}],"byBranch":{}}
        """;

    /// <summary>Giá trị mặc định khi chưa có cấu hình ở scope nào.</summary>
    public static readonly IReadOnlyDictionary<string, string> Defaults = new Dictionary<string, string>
    {
        [FileStorageMode] = "Server",
        [TuitionDueSoonDays] = "7",
        [WarningScoreDropThreshold] = "1.5",
        [CenterCodePrefix] = "HV",
        [AccountDefaultPassword] = "Hocvien@123",
        [AccountLocalEmailDomain] = "hs.local",
        [ScheduleShifts] = DefaultShiftsJson
    };
}
