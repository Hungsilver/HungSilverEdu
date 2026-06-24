using HungSilver.Domain.Common;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>
/// Kiểm thử sinh mã theo tên người Việt: prefix giáo viên TỰ MANG dấu phân tách (không thêm "-"),
/// và prefix mặc định theo tên cơ sở (PascalCompact + "@") cho ra mã "DongTho@TrangNTT0".
/// </summary>
public sealed class NameCodeGeneratorTests
{
    [Theory]
    [InlineData("Đông Thọ", "DongTho")]
    [InlineData("Cầu Giấy", "CauGiay")]
    [InlineData("HÀ NỘI", "HaNoi")]
    [InlineData("  Đống   Đa  ", "DongDa")]
    public void PascalCompact_BoDau_PascalCaseLien(string name, string expected)
        => Assert.Equal(expected, NameCodeGenerator.PascalCompact(name));

    [Fact]
    public void GenerateTeacherCode_PrefixTuMangDauPhanTach()
    {
        // Prefix mặc định theo cơ sở "Đông Thọ" → "DongTho@"; GV "Nguyễn Thị Thu Trang", counter 0.
        var prefix = NameCodeGenerator.PascalCompact("Đông Thọ") + "@";
        var code = NameCodeGenerator.GenerateTeacherCode("Nguyễn Thị Thu Trang", prefix, 0);
        Assert.Equal("DongTho@TrangNTT0", code);
    }

    [Fact]
    public void GenerateTeacherCode_PrefixTuyBien_GiuNguyen()
    {
        var code = NameCodeGenerator.GenerateTeacherCode("Phạm Hoàng Anh", "GV-", 2);
        Assert.Equal("GV-AnhPH2", code);
    }
}
