namespace HungSilver.Infrastructure.Documents;

/// <summary>Cấu hình chuyển tài liệu sang PDF (section "DocumentConversion").</summary>
public sealed class DocumentConversionOptions
{
    public const string SectionName = "DocumentConversion";

    /// <summary>Đường dẫn tới <c>soffice</c> (LibreOffice). Trống ⇒ dùng "soffice" trên PATH.</summary>
    public string? SofficePath { get; set; }

    /// <summary>Thời gian tối đa cho 1 lần convert (giây).</summary>
    public int TimeoutSeconds { get; set; } = 90;
}
