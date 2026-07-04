using FluentValidation;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.Materials;

public sealed class CreateMaterialRequestValidator : AbstractValidator<CreateMaterialRequest>
{
    public CreateMaterialRequestValidator()
    {
        RuleFor(x => x.SubjectId).Must(id => id.HasValue && id != Guid.Empty).WithMessage("Chọn môn học cho tài liệu.");
        RuleFor(x => x.CategoryId).Must(id => id.HasValue && id != Guid.Empty).WithMessage("Chọn loại tài liệu.");
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
        RuleFor(x => x.SubjectId).Must(id => id.HasValue && id != Guid.Empty).WithMessage("Chọn môn học cho tài liệu.");
        RuleFor(x => x.CategoryId).Must(id => id.HasValue && id != Guid.Empty).WithMessage("Chọn loại tài liệu.");
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Url).NotEmpty().MaximumLength(1000).When(x => x.Source == MaterialSource.ExternalUrl);
        RuleFor(x => x.StoredFileId).NotEmpty().When(x => x.Source == MaterialSource.ServerFile);
        RuleFor(x => x.Description).MaximumLength(2000);
    }
}
