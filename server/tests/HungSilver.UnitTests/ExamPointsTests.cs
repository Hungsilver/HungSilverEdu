using HungSilver.Application.Exams;
using HungSilver.Domain.Entities;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>Chia điểm đề dùng chung: tổng LUÔN đúng bằng total, không câu nào âm, câu đầu nhận phần dư.</summary>
public sealed class ExamPointsTests
{
    private static List<ExamQuestion> Questions(int count) =>
        Enumerable.Range(0, count).Select(i => new ExamQuestion { OrderNo = i }).ToList();

    [Fact]
    public void ThreeQuestions_Total10_FirstGetsRemainder()
    {
        var qs = Questions(3);
        ExamPoints.Distribute(qs, 10m);
        Assert.Equal(3.34m, qs[0].Points);
        Assert.Equal(3.33m, qs[1].Points);
        Assert.Equal(3.33m, qs[2].Points);
        Assert.Equal(10m, qs.Sum(q => q.Points));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(4)]
    [InlineData(7)]
    [InlineData(150)]
    [InlineData(499)]
    public void AnyCount_SumIsExactlyTotal_NoNegative(int count)
    {
        var qs = Questions(count);
        ExamPoints.Distribute(qs, 10m);
        Assert.Equal(10m, qs.Sum(q => q.Points));
        Assert.All(qs, q => Assert.True(q.Points >= 0m));
    }

    [Fact]
    public void EmptyList_IsNoOp()
    {
        ExamPoints.Distribute(new List<ExamQuestion>(), 10m);
    }
}
