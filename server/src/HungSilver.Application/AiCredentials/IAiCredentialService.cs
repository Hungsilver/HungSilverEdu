using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.AiCredentials;

/// <summary>Quản lý API Key AI của tài khoản hiện tại (mọi vai trò tự cấu hình key của mình).</summary>
public interface IAiCredentialService
{
    Task<Result<AiCredentialDto>> GetAsync(Guid userId, CancellationToken ct = default);
    Task<Result<AiCredentialDto>> SaveAsync(Guid userId, SaveAiCredentialRequest request, CancellationToken ct = default);
    Task<Result<ValidateAiKeyResult>> ValidateAsync(Guid userId, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid userId, CancellationToken ct = default);
}
