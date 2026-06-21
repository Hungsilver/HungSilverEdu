using FluentValidation;

namespace HungSilver.Application.Classes;

public sealed class CreateClassRequestValidator : AbstractValidator<CreateClassRequest>
{
    public CreateClassRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ClassCode).MaximumLength(30);
        RuleFor(x => x.TeacherProfileId).NotEmpty();
        RuleFor(x => x.TuitionFee).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MaxCapacity).GreaterThan(0).LessThanOrEqualTo(1000);
        RuleFor(x => x.Schedule).MaximumLength(500);
    }
}

public sealed class UpdateClassRequestValidator : AbstractValidator<UpdateClassRequest>
{
    public UpdateClassRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ClassCode).MaximumLength(30);
        RuleFor(x => x.TeacherProfileId).NotEmpty();
        RuleFor(x => x.TuitionFee).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MaxCapacity).GreaterThan(0).LessThanOrEqualTo(1000);
        RuleFor(x => x.Schedule).MaximumLength(500);
    }
}
