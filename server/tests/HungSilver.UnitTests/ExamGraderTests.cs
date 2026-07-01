using HungSilver.Application.Exams;
using HungSilver.Domain.Enums;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>Kiểm thử tự chấm 4 loại câu — gồm chấm từng phần (Matching/FillBlank) + chuẩn hóa (trim/lower).</summary>
public class ExamGraderTests
{
    [Theory]
    [InlineData("{\"key\":\"B\"}", "{\"key\":\"b\"}", true, 1)]   // khớp không phân biệt hoa/thường
    [InlineData("{\"key\":\"B\"}", "{\"key\":\"A\"}", false, 0)]
    [InlineData("{\"key\":\"B\"}", null, false, 0)]
    public void SingleChoice(string answer, string? response, bool correct, double frac)
    {
        var (c, f) = ExamGrader.Grade(ExamQuestionType.SingleChoice, answer, response);
        Assert.Equal(correct, c);
        Assert.Equal((decimal)frac, f);
    }

    [Theory]
    [InlineData("{\"value\":true}", "{\"value\":true}", true)]
    [InlineData("{\"value\":true}", "{\"value\":false}", false)]
    public void TrueFalse(string answer, string response, bool correct)
    {
        var (c, f) = ExamGrader.Grade(ExamQuestionType.TrueFalse, answer, response);
        Assert.Equal(correct, c);
        Assert.Equal(correct ? 1m : 0m, f);
    }

    [Fact]
    public void FillBlank_PartialCredit_AndNormalization()
    {
        const string answer = "{\"blanks\":[[\"mental\",\"tinh thần\"],[\"priority\"]]}";

        var (allCorrect, full) = ExamGrader.Grade(ExamQuestionType.FillBlank, answer, "{\"blanks\":[\"  MENTAL \",\"priority\"]}");
        Assert.True(allCorrect);
        Assert.Equal(1m, full);

        var (half, halfFrac) = ExamGrader.Grade(ExamQuestionType.FillBlank, answer, "{\"blanks\":[\"mental\",\"wrong\"]}");
        Assert.False(half);
        Assert.Equal(0.5m, halfFrac);
    }

    [Fact]
    public void Matching_PartialCredit()
    {
        const string answer = "{\"pairs\":{\"1\":\"a\",\"2\":\"b\"}}";

        var (full, fFrac) = ExamGrader.Grade(ExamQuestionType.Matching, answer, "{\"pairs\":{\"1\":\"a\",\"2\":\"b\"}}");
        Assert.True(full);
        Assert.Equal(1m, fFrac);

        var (half, hFrac) = ExamGrader.Grade(ExamQuestionType.Matching, answer, "{\"pairs\":{\"1\":\"a\",\"2\":\"c\"}}");
        Assert.False(half);
        Assert.Equal(0.5m, hFrac);
    }
}
