namespace HungSilver.Application.AiCredentials;

/// <summary>Trạng thái cấu hình AI của user — KHÔNG chứa key thô (chỉ key đã che).</summary>
public sealed record AiCredentialDto(
    bool HasKey,
    string? MaskedKey,
    string Provider,
    string? Model,
    DateTime? LastValidatedAt,
    bool? IsValid);

public sealed record SaveAiCredentialRequest(string ApiKey, string? Model);

public sealed record ValidateAiKeyResult(bool IsValid, string? Message);
