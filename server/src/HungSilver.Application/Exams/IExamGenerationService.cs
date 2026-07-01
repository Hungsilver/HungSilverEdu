using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Exams;

/// <summary>Sinh đề trắc nghiệm từ tài liệu upload bằng AI (chuẩn hóa PDF → vision → schema → kiểm chứng 3 lớp).</summary>
public interface IExamGenerationService
{
    Task<Result<ExamGenerationResult>> GenerateFromMaterialAsync(
        Guid materialId, GenerateExamRequest request, Guid userId, CancellationToken ct = default);
}

public interface IExamGenerationJobService
{
    Task<Result<ExamGenerationJobStartResult>> StartAsync(
        Guid materialId, GenerateExamRequest request, Guid userId, CancellationToken ct = default);

    Result<ExamGenerationJobDto> Get(Guid jobId, Guid userId);
}
