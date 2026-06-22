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

    /// <summary>Múi giờ trung tâm (IANA), vd "Asia/Ho_Chi_Minh".</summary>
    public const string CenterTimeZone = "Center.TimeZone";

    /// <summary>Danh sách Khối chuẩn (phân tách bằng xuống dòng/dấu phẩy) — dùng cho lớp &amp; học liệu (Đợt 7).</summary>
    public const string ClassGradeBands = "Class.GradeBands";

    /// <summary>Tiền tố dùng trong mã giáo viên (vd "TriViet" → "TriViet-TrangNTT0"). Mặc định "HV".</summary>
    public const string CenterCodePrefix = "Center.CodePrefix";

    /// <summary>Giá trị mặc định khi chưa có cấu hình ở scope nào.</summary>
    public static readonly IReadOnlyDictionary<string, string> Defaults = new Dictionary<string, string>
    {
        [FileStorageMode] = "Server",
        [TuitionDueSoonDays] = "7",
        [WarningScoreDropThreshold] = "1.5",
        [CenterTimeZone] = "Asia/Ho_Chi_Minh",
        [ClassGradeBands] = "Mầm non\nKhối 1\nKhối 2\nKhối 3\nKhối 4\nKhối 5\nKhối 6\nKhối 7\nKhối 8\nKhối 9\nKhối 10\nKhối 11\nKhối 12\nNgười lớn",
        [CenterCodePrefix] = "HV"
    };
}
