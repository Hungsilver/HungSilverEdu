namespace HungSilver.Infrastructure.Ai;

/// <summary>Cấu hình gọi Google Gemini (section "Ai:Gemini" trong appsettings).</summary>
public sealed class GeminiOptions
{
    public const string SectionName = "Ai:Gemini";

    /// <summary>Base URL của Generative Language API.</summary>
    public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com";

    /// <summary>Model mặc định gợi ý cho FE khi user chưa chọn.</summary>
    public string DefaultModel { get; set; } = "gemini-2.5-flash";
}
