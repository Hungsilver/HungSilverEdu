namespace HungSilver.Infrastructure.Storage;

/// <summary>
/// Kiểm "magic-byte" (chữ ký nội dung) khớp với phần mở rộng — chống đổi đuôi giả mạo
/// (vd file HTML đổi tên thành .png). txt/csv không có chữ ký ⇒ bỏ qua (an toàn nhờ allowlist
/// không chứa .html/.svg + tải xuống dạng attachment + nosniff).
/// </summary>
public static class FileSignatureValidator
{
    // Một số định dạng có nhiều biến thể chữ ký ⇒ mỗi đuôi map sang danh sách prefix.
    private static readonly byte[] Pk = [0x50, 0x4B, 0x03, 0x04];                          // ZIP (cả docx/xlsx/pptx)
    private static readonly byte[] PkEmpty = [0x50, 0x4B, 0x05, 0x06];
    private static readonly byte[] PkSpanned = [0x50, 0x4B, 0x07, 0x08];
    private static readonly byte[] Ole = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]; // doc/xls/ppt cũ

    private static readonly Dictionary<string, byte[][]> Signatures = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"] = ["%PDF"u8.ToArray()],
        [".jpg"] = [[0xFF, 0xD8, 0xFF]],
        [".jpeg"] = [[0xFF, 0xD8, 0xFF]],
        [".png"] = [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
        [".gif"] = ["GIF87a"u8.ToArray(), "GIF89a"u8.ToArray()],
        [".zip"] = [Pk, PkEmpty, PkSpanned],
        [".docx"] = [Pk],
        [".xlsx"] = [Pk],
        [".pptx"] = [Pk],
        [".doc"] = [Ole],
        [".xls"] = [Ole],
        [".ppt"] = [Ole],
    };

    private const int HeaderBytes = 16;

    /// <summary>Số byte đầu cần đọc để kiểm chữ ký.</summary>
    public static int RequiredHeaderBytes => HeaderBytes;

    /// <summary>true nếu header khớp (hoặc đuôi không cần kiểm). false nếu chữ ký sai.</summary>
    public static bool IsContentValid(string extension, ReadOnlySpan<byte> header)
    {
        var ext = extension.ToLowerInvariant();

        // WEBP: "RIFF"....("WEBP") — chữ ký nằm ở offset 0 và 8.
        if (ext == ".webp")
            return header.Length >= 12
                && header[..4].SequenceEqual("RIFF"u8)
                && header.Slice(8, 4).SequenceEqual("WEBP"u8);

        // txt/csv hoặc đuôi không có trong bảng ⇒ không chặn (allowlist đuôi đã là cổng chính).
        if (!Signatures.TryGetValue(ext, out var alternatives))
            return true;

        foreach (var sig in alternatives)
            if (header.Length >= sig.Length && header[..sig.Length].SequenceEqual(sig))
                return true;

        return false;
    }
}
