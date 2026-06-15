using FluentValidation;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.Materials;

public sealed class CreateMaterialRequestValidator : AbstractValidator<CreateMaterialRequest>
{
    public CreateMaterialRequestValidator()
    {
        // Học liệu phải thuộc 1 lớp HOẶC 1 danh mục thư viện.
        RuleFor(x => x)
            .Must(r => (r.ClassId.HasValue && r.ClassId != Guid.Empty) || (r.CategoryId.HasValue && r.CategoryId != Guid.Empty))
            .WithMessage("Chọn lớp hoặc danh mục cho học liệu.");
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Url).NotEmpty().MaximumLength(1000).When(x => x.Source == MaterialSource.ExternalUrl);
        RuleFor(x => x.StoredFileId).NotEmpty().When(x => x.Source == MaterialSource.ServerFile);
        RuleFor(x => x.Description).MaximumLength(2000);
    }
}

public sealed class UpdateMaterialRequestValidator : AbstractValidator<UpdateMaterialRequest>
{
    public UpdateMaterialRequestValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Url).NotEmpty().MaximumLength(1000).When(x => x.Source == MaterialSource.ExternalUrl);
        RuleFor(x => x.StoredFileId).NotEmpty().When(x => x.Source == MaterialSource.ServerFile);
        RuleFor(x => x.Description).MaximumLength(2000);
    }
}
