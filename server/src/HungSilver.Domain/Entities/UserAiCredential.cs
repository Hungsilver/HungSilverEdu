using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>
/// Cấu hình tích hợp AI theo từng tài khoản: mỗi user lưu API Key của riêng mình
/// (vd Google Gemini do user tự tạo ở Google AI Studio rồi paste vào web).
/// Key được <b>mã hóa</b> khi lưu (Data Protection) — chỉ giữ 4 ký tự cuối để hiển thị che.
/// KHÔNG khóa ngoại (quy ước §15.1): chỉ <see cref="UserId"/> + index; 1-1 với tài khoản qua partial unique index.
/// </summary>
public class UserAiCredential : BaseEntity
{
    public Guid UserId { get; set; }

    /// <summary>Nhà cung cấp AI — hiện chỉ "Gemini" (Google AI Studio); để mở rộng về sau.</summary>
    public string Provider { get; set; } = "Gemini";

    /// <summary>API Key đã mã hóa (Data Protection). KHÔNG bao giờ trả raw ra ngoài.</summary>
    public string ApiKeyEncrypted { get; set; } = string.Empty;

    /// <summary>4 ký tự cuối của key — chỉ để hiển thị dạng che "••••••••abcd".</summary>
    public string? KeyLast4 { get; set; }

    /// <summary>Model Gemini đã chọn (vd "gemini-2.5-flash").</summary>
    public string? Model { get; set; }

    /// <summary>Thời điểm "Kiểm tra key" gần nhất.</summary>
    public DateTime? LastValidatedAt { get; set; }

    /// <summary>Kết quả kiểm tra gần nhất: true=hợp lệ, false=lỗi, null=chưa kiểm tra.</summary>
    public bool? IsValid { get; set; }
}
