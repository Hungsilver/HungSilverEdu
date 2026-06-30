using FluentValidation;

namespace HungSilver.Application.AiCredentials;

public sealed class SaveAiCredentialRequestValidator : AbstractValidator<SaveAiCredentialRequest>
{
    public SaveAiCredentialRequestValidator()
    {
        // Chỉ kiểm sơ bộ; tính hợp lệ thật xác thực bằng live call tới Gemini.
        RuleFor(x => x.ApiKey).NotEmpty().WithMessage("Vui lòng nhập API Key.")
            .MinimumLength(20).WithMessage("API Key không hợp lệ.")
            .MaximumLength(200);
        RuleFor(x => x.Model).MaximumLength(80);
    }
}
