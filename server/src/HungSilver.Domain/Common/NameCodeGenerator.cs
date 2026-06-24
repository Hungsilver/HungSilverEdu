using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace HungSilver.Domain.Common;

/// <summary>Sinh mã học viên/giáo viên/danh mục theo quy tắc tên người Việt.</summary>
public static class NameCodeGenerator
{
    // Bỏ dấu tiếng Việt, trả về chuỗi ASCII chữ hoa.
    public static string RemoveDiacritics(string s)
    {
        if (string.IsNullOrWhiteSpace(s)) return string.Empty;
        // đ/Đ không nằm trong Unicode decomposition → xử lý riêng trước khi NFD.
        s = s.Replace('đ', 'd').Replace('Đ', 'D');
        var nfd = s.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(nfd.Length);
        foreach (var c in nfd)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC).ToUpperInvariant();
    }

    /// <summary>
    /// Tách họ tên tiếng Việt: từ cuối là tên, các từ còn lại lấy chữ đầu làm viết tắt.
    /// "Phạm Hoàng Anh" → firstName="ANH", initials="PH"
    /// </summary>
    public static (string firstName, string initials) SplitName(string fullName)
    {
        var parts = fullName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return ("X", "");
        var firstName = RemoveDiacritics(parts[^1]);
        var initials = string.Concat(parts[..^1]
            .Select(p => RemoveDiacritics(p))
            .Where(p => p.Length > 0)
            .Select(p => p[0].ToString()));
        return (firstName, initials);
    }

    /// <summary>
    /// Sinh mã học viên: 2K{khoi}{TEN}{VIET_TAT}{counter}
    /// Nếu có ngày sinh: lấy năm % 100 không zero-pad — 2009→"9", 2010→"10"
    /// Nếu không: trích từ tên khối. Ví dụ: "Nguyễn Văn Nga" sinh 10/02/2009 → "2K9NGANV0"
    /// </summary>
    public static string GenerateStudentCode(string fullName, DateOnly? dateOfBirth, string? gradeLevel, int counter = 0)
    {
        var grade = dateOfBirth.HasValue
            ? (dateOfBirth.Value.Year % 100).ToString()
            : ExtractGrade(gradeLevel);
        var (first, initials) = SplitName(fullName);
        return $"2K{grade}{first}{initials}{counter}";
    }

    /// <summary>Overload tương thích ngược (không có ngày sinh).</summary>
    public static string GenerateStudentCode(string fullName, string? gradeLevel, int counter = 0)
        => GenerateStudentCode(fullName, null, gradeLevel, counter);

    /// <summary>
    /// Sinh mã giáo viên: {prefix}{Ten}{VietTat}{counter} (tên PascalCase, viết tắt in hoa).
    /// Prefix TỰ MANG dấu phân tách của nó (không thêm "-" cứng).
    /// Ví dụ: "Nguyễn Thị Thu Trang", prefix="DongTho@", counter=0 → "DongTho@TrangNTT0"
    /// </summary>
    public static string GenerateTeacherCode(string fullName, string prefix, int counter = 0)
    {
        var (first, initials) = SplitName(fullName);
        var firstPascal = first.Length > 0
            ? char.ToUpperInvariant(first[0]) + first[1..].ToLowerInvariant()
            : first;
        return $"{prefix}{firstPascal}{initials}{counter}";
    }

    /// <summary>
    /// Ghép tên thành PascalCase liền (bỏ dấu, mỗi từ: chữ đầu hoa + còn lại thường).
    /// Dùng làm prefix mặc định theo tên cơ sở: "Đông Thọ" → "DongTho".
    /// </summary>
    public static string PascalCompact(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return string.Empty;
        var parts = name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return string.Concat(parts
            .Select(p => RemoveDiacritics(p))
            .Where(p => p.Length > 0)
            .Select(p => char.ToUpperInvariant(p[0]) + p[1..].ToLowerInvariant()));
    }

    /// <summary>Slug ngắn từ tên danh mục để tự sinh Code (không dấu, không khoảng trắng).</summary>
    public static string SlugCode(string name, int maxLen = 6)
    {
        var clean = RemoveDiacritics(name.Trim());
        var alphanum = new string(clean.Where(char.IsLetterOrDigit).ToArray());
        return alphanum.Length > maxLen ? alphanum[..maxLen] : alphanum;
    }

    // Trích phần khối từ gradeLevel: "Khối 10" → "10"; "Mầm non" → "MN"; "" → ""
    private static string ExtractGrade(string? gradeLevel)
    {
        if (string.IsNullOrWhiteSpace(gradeLevel)) return "";
        var match = Regex.Match(gradeLevel, @"\d+");
        if (match.Success) return match.Value;
        var slug = RemoveDiacritics(gradeLevel.Trim());
        var letters = new string(slug.Where(char.IsLetter).ToArray());
        return letters.Length >= 2 ? letters[..2] : letters;
    }
}
