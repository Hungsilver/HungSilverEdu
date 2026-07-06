using HungSilver.Domain.Entities;

namespace HungSilver.Application.Exams;

/// <summary>Chia điểm đề dùng chung cho mọi luồng tạo/sửa đề (AI sinh, soạn tay, tạo từ ngân hàng câu hỏi).</summary>
public static class ExamPoints
{
    /// <summary>
    /// Chia đều <paramref name="totalPoints"/> theo đơn vị 0.01: n câu đầu nhận thêm 0.01 phần dư
    /// ⇒ tổng LUÔN đúng bằng total và không câu nào bị điểm âm (cách cũ round từng câu rồi trừ dồn
    /// làm câu cuối ÂM khi đề ≥ ~150 câu).
    /// </summary>
    public static void Distribute(IReadOnlyList<ExamQuestion> questions, decimal totalPoints)
    {
        if (questions.Count == 0) return;
        var totalCents = (int)decimal.Round(totalPoints * 100m, 0, MidpointRounding.AwayFromZero);
        var baseCents = totalCents / questions.Count;
        var extra = totalCents - baseCents * questions.Count;
        for (var i = 0; i < questions.Count; i++)
            questions[i].Points = (baseCents + (i < extra ? 1 : 0)) / 100m;
    }
}
