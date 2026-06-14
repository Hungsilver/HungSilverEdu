using System.Text;

namespace HungSilver.Application.Notifications.Templates;

public sealed record SessionNoticeModel(
    string ClassName,
    int SessionNumber,
    DateOnly SessionDate,
    string? Topic,
    string? ContentTaught,
    int PresentCount,
    int TotalCount,
    IReadOnlyList<string> ActiveStudents,
    string? Homework,
    DateOnly? NextSessionDate,
    TimeOnly? NextSessionStart);

public sealed record ScheduleNoticeModel(
    string ClassName,
    DateOnly Date,
    TimeOnly? Start,
    TimeOnly? End,
    string? Topic);

public sealed record ParentReportModel(
    string StudentName,
    int Year,
    int Month,
    int SessionsAttended,
    int SessionsTotal,
    decimal HomeworkPercent,
    int RewardPoints,
    string? AssessmentText,
    string? Suggestion);

/// <summary>Mẫu nội dung báo cáo/thông báo (thuần chuỗi, không phụ thuộc hạ tầng).</summary>
public static class ReportTemplates
{
    public static string RenderSessionNotice(SessionNoticeModel m)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"THÔNG BÁO BUỔI HỌC {m.SessionNumber} — Lớp {m.ClassName}");
        sb.AppendLine($"🗓 Ngày: {m.SessionDate:dd/MM/yyyy}");
        sb.AppendLine();
        sb.AppendLine("📚 Nội dung học:");
        sb.AppendLine($"- {(string.IsNullOrWhiteSpace(m.ContentTaught) ? (m.Topic ?? "(chưa cập nhật)") : m.ContentTaught)}");
        sb.AppendLine();
        sb.AppendLine("👨‍🎓 Tình hình học tập:");
        sb.AppendLine($"- Sĩ số có mặt: {m.PresentCount}/{m.TotalCount}");
        sb.AppendLine();

        if (m.ActiveStudents.Count > 0)
        {
            sb.AppendLine("⭐ Học sinh tích cực:");
            foreach (var name in m.ActiveStudents)
                sb.AppendLine($"- {name}");
            sb.AppendLine();
        }

        sb.AppendLine("🏠 Bài tập về nhà:");
        sb.AppendLine($"- {(string.IsNullOrWhiteSpace(m.Homework) ? "(xem trên lớp)" : m.Homework)}");

        if (m.NextSessionDate is not null)
        {
            sb.AppendLine();
            sb.AppendLine("Buổi học tiếp theo:");
            sb.Append($"🗓 {m.NextSessionDate:dd/MM/yyyy}");
            if (m.NextSessionStart is not null)
                sb.Append($"  ⏰ {m.NextSessionStart:HH\\:mm}");
            sb.AppendLine();
        }

        sb.AppendLine();
        sb.AppendLine("Trân trọng!");
        return sb.ToString();
    }

    public static string RenderParentReport(ParentReportModel m)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"BÁO CÁO THÁNG {m.Month}/{m.Year}");
        sb.AppendLine($"Học sinh: {m.StudentName}");
        sb.AppendLine();
        sb.AppendLine($"📅 Đi học: {m.SessionsAttended}/{m.SessionsTotal} buổi");
        sb.AppendLine($"🏠 Bài tập: {m.HomeworkPercent:0}%");
        sb.AppendLine($"⭐ Điểm thưởng: {(m.RewardPoints >= 0 ? "+" : "")}{m.RewardPoints}");
        sb.AppendLine();
        sb.AppendLine("📝 Đánh giá:");
        sb.AppendLine(string.IsNullOrWhiteSpace(m.AssessmentText) ? "- (chưa cập nhật)" : m.AssessmentText);
        if (!string.IsNullOrWhiteSpace(m.Suggestion))
        {
            sb.AppendLine();
            sb.AppendLine("💡 Đề xuất:");
            sb.AppendLine(m.Suggestion);
        }
        sb.AppendLine();
        sb.AppendLine("Trân trọng!");
        return sb.ToString();
    }

    public static string RenderScheduleNotice(ScheduleNoticeModel m)
    {
        var sb = new StringBuilder();
        sb.AppendLine("THÔNG BÁO LỊCH HỌC");
        sb.AppendLine();
        sb.AppendLine("Kính gửi phụ huynh,");
        sb.AppendLine($"Lớp {m.ClassName} sẽ học vào:");
        sb.Append($"🗓 {m.Date:dddd - dd/MM/yyyy}");
        sb.AppendLine();
        if (m.Start is not null)
            sb.AppendLine($"⏰ {m.Start:HH\\:mm}{(m.End is not null ? $" - {m.End:HH\\:mm}" : "")}");
        if (!string.IsNullOrWhiteSpace(m.Topic))
        {
            sb.AppendLine("📚 Nội dung:");
            sb.AppendLine(m.Topic);
        }
        sb.AppendLine();
        sb.AppendLine("Trân trọng!");
        return sb.ToString();
    }
}
