using FluentValidation;

namespace HungSilver.Application.Grades;

public sealed class CreateGradeRequestValidator : AbstractValidator<CreateGradeRequest>
{
    public CreateGradeRequestValidator()
    {
        RuleFor(x => x.Code).MaximumLength(50).When(x => x.Code != null);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
    }
}

public sealed class UpdateGradeRequestValidator : AbstractValidator<UpdateGradeRequest>
{
    public UpdateGradeRequestValidator()
    {
        RuleFor(x => x.Code).MaximumLength(50).When(x => x.Code != null);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
    }
}
