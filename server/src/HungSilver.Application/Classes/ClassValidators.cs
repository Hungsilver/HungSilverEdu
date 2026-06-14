using FluentValidation;

namespace HungSilver.Application.Classes;

public sealed class CreateClassRequestValidator : AbstractValidator<CreateClassRequest>
{
    public CreateClassRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.TeacherId).NotEmpty();
        RuleFor(x => x.MaxCapacity).GreaterThan(0).LessThanOrEqualTo(1000);
        RuleFor(x => x.Schedule).MaximumLength(500);
    }
}

public sealed class UpdateClassRequestValidator : AbstractValidator<UpdateClassRequest>
{
    public UpdateClassRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.TeacherId).NotEmpty();
        RuleFor(x => x.MaxCapacity).GreaterThan(0).LessThanOrEqualTo(1000);
        RuleFor(x => x.Schedule).MaximumLength(500);
    }
}
