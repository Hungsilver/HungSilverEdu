using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Exams;

/// <summary>Sinh đề trắc nghiệm từ tài liệu upload bằng AI (chuẩn hóa PDF → vision → schema → kiểm chứng 3 lớp).</summary>
public interface IExamGenerationService
{
    Task<Result<ExamGenerationResult>> GenerateFromMaterialAsync(
        Guid materialId, GenerateExamRequest request, Guid userId, CancellationToken ct = default);
}
