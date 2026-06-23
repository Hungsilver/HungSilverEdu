using FluentValidation;

namespace HungSilver.Application.PointReasons;

public sealed class CreatePointReasonRequestValidator : AbstractValidator<CreatePointReasonRequest>
{
    public CreatePointReasonRequestValidator()
    {
        RuleFor(x => x.Label).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Points).InclusiveBetween(1, 10);
        RuleFor(x => x.IndexOrder).GreaterThanOrEqualTo(0);
    }
}

public sealed class UpdatePointReasonRequestValidator : AbstractValidator<UpdatePointReasonRequest>
{
    public UpdatePointReasonRequestValidator()
    {
        RuleFor(x => x.Label).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Points).InclusiveBetween(1, 10);
        RuleFor(x => x.IndexOrder).GreaterThanOrEqualTo(0);
    }
}
