using FluentValidation;
using HungSilver.Application.Abstractions;
using HungSilver.Application.AiCredentials;
using HungSilver.Application.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;

namespace HungSilver.Infrastructure.AiCredentials;

/// <summary>
/// Nguồn sự thật cho cấu hình API Key AI theo tài khoản. Mã hóa key khi lưu (<see cref="ISecretProtector"/>),
/// chỉ trả key đã che ra DTO. Cũng hiện thực <see cref="IAiCredentialResolver"/> cho tính năng AI tương lai.
/// </summary>
public sealed class AiCredentialService(
    IRepository<UserAiCredential> repo,
    IUnitOfWork unitOfWork,
    ISecretProtector protector,
    IGeminiClient gemini,
    IValidator<SaveAiCredentialRequest> saveValidator) : IAiCredentialService, IAiCredentialResolver
{
    private const string GeminiProvider = "Gemini";
    private static readonly Error NotConfigured =
        Error.NotFound("Ai.KeyMissing", "Tài khoản chưa cấu hình API Key Gemini.");

    public async Task<Result<AiCredentialDto>> GetAsync(Guid userId, CancellationToken ct = default)
        => ToDto(await FindAsync(userId, ct));

    public async Task<Result<AiCredentialDto>> SaveAsync(Guid userId, SaveAiCredentialRequest request, CancellationToken ct = default)
    {
        var validation = await saveValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<AiCredentialDto>(validation.ToError("Ai.Validation"));

        var apiKey = request.ApiKey.Trim();
        var cred = await FindAsync(userId, ct);
        if (cred is null)
        {
            cred = new UserAiCredential { UserId = userId, Provider = GeminiProvider };
            ApplyKey(cred, apiKey, request.Model);
            await repo.AddAsync(cred, ct);
        }
        else
        {
            ApplyKey(cred, apiKey, request.Model);
            repo.Update(cred);
        }

        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(cred);
    }

    public async Task<Result<ValidateAiKeyResult>> ValidateAsync(Guid userId, CancellationToken ct = default)
    {
        var cred = await FindAsync(userId, ct);
        if (cred is null)
            return Result.Failure<ValidateAiKeyResult>(NotConfigured);

        var apiKey = protector.Unprotect(cred.ApiKeyEncrypted);
        var result = await gemini.ValidateKeyAsync(apiKey, ct);

        cred.LastValidatedAt = DateTime.Now;
        cred.IsValid = result.IsSuccess;
        repo.Update(cred);
        await unitOfWork.SaveChangesAsync(ct);

        return new ValidateAiKeyResult(result.IsSuccess, result.IsSuccess ? "API Key hợp lệ." : result.Error.Message);
    }

    public async Task<Result> DeleteAsync(Guid userId, CancellationToken ct = default)
    {
        var cred = await FindAsync(userId, ct);
        if (cred is null) return Result.Failure(NotConfigured);

        repo.SoftDelete(cred);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }

    // ---- Seam cho tính năng AI tương lai ----
    public async Task<Result<string>> GetApiKeyForUserAsync(Guid userId, CancellationToken ct = default)
    {
        var cred = await FindAsync(userId, ct);
        if (cred is null) return Result.Failure<string>(NotConfigured);
        return protector.Unprotect(cred.ApiKeyEncrypted);
    }

    private async Task<UserAiCredential?> FindAsync(Guid userId, CancellationToken ct)
        => (await repo.FindAsync(c => c.UserId == userId, ct)).FirstOrDefault();

    private void ApplyKey(UserAiCredential cred, string apiKey, string? model)
    {
        cred.ApiKeyEncrypted = protector.Protect(apiKey);
        cred.KeyLast4 = apiKey.Length >= 4 ? apiKey[^4..] : apiKey;
        if (!string.IsNullOrWhiteSpace(model)) cred.Model = model.Trim();
        // Lưu key mới ⇒ reset trạng thái kiểm tra.
        cred.LastValidatedAt = null;
        cred.IsValid = null;
    }

    private static Result<AiCredentialDto> ToDto(UserAiCredential? cred) =>
        cred is null
            ? new AiCredentialDto(false, null, GeminiProvider, null, null, null)
            : new AiCredentialDto(true, "••••••••" + (cred.KeyLast4 ?? ""), cred.Provider, cred.Model, cred.LastValidatedAt, cred.IsValid);
}
