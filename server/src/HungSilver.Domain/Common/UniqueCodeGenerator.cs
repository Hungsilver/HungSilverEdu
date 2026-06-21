using System.Threading;

namespace HungSilver.Domain.Common;

/// <summary>
/// Sinh mã duy nhất không cần kiểm tra DB.
/// Nguyên lý: atomic counter seed từ Unix-ms + random offset → mã luôn tăng,
/// không trùng ngay cả khi restart process. Kết quả mã hóa base-36 (0-9 + A-Z)
/// cho ngắn gọn và thân thiện.
/// </summary>
public static class UniqueCodeGenerator
{
    private static readonly char[] Base36Chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".ToCharArray();

    // Seed = Unix milliseconds * 1000 + random(0..999) → duy nhất qua mỗi lần khởi động
    private static long _counter = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() * 1000
                                   + Random.Shared.Next(1000);

    /// <summary>
    /// Sinh mã duy nhất dạng {prefix}{base36}. Thread-safe, không I/O.
    /// <para>Ví dụ: <c>Next("HS")</c> → <c>"HS1RJZ4K5M"</c></para>
    /// </summary>
    public static string Next(string prefix = "")
    {
        var value = Interlocked.Increment(ref _counter);
        return string.Concat(prefix, ToBase36(value));
    }

    private static string ToBase36(long value)
    {
        // Số dương, tối đa ~13 ký tự cho long.MaxValue
        Span<char> buffer = stackalloc char[13];
        var i = buffer.Length;

        do
        {
            buffer[--i] = Base36Chars[value % 36];
            value /= 36;
        } while (value > 0);

        return new string(buffer[i..]);
    }
}
