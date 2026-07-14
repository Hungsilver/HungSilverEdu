using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Exams;

/// <summary>Sinh đề trắc nghiệm từ tài liệu upload bằng AI (chuẩn hóa PDF → vision → schema → kiểm chứng 3 lớp).</summary>
public interface IExamGenerationService
{
    /// <param name="sourceStoredFileId">File upload trực tiếp thay cho file của tài liệu (luồng generate-upload) —
    /// khi có, tài liệu nguồn chỉ dùng làm ngữ cảnh Môn/Khối và nơi neo đề.</param>
    Task<Result<ExamGenerationResult>> GenerateFromMaterialAsync(
        Guid materialId, GenerateExamRequest request, Guid userId,
        Guid? sourceStoredFileId = null, CancellationToken ct = default);
}

public interface IExamGenerationJobService
{
    /// <param name="sourceStoredFileId">File upload trực tiếp thay cho file của tài liệu (luồng generate-upload).</param>
    Task<Result<ExamGenerationJobStartResult>> StartAsync(
        Guid materialId, GenerateExamRequest request, Guid userId,
        Guid? sourceStoredFileId = null, CancellationToken ct = default);

    Result<ExamGenerationJobDto> Get(Guid jobId, Guid userId);
}
