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

    /// <summary>Giá trị mặc định khi chưa có cấu hình ở scope nào.</summary>
    public static readonly IReadOnlyDictionary<string, string> Defaults = new Dictionary<string, string>
    {
        [FileStorageMode] = "ExternalUrl",
        [TuitionDueSoonDays] = "7",
        [WarningScoreDropThreshold] = "1.5",
        [CenterTimeZone] = "Asia/Ho_Chi_Minh"
    };
}
