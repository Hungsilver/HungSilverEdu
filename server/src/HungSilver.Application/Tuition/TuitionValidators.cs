using FluentValidation;

namespace HungSilver.Application.Tuition;

public sealed class CreateTuitionInvoiceRequestValidator : AbstractValidator<CreateTuitionInvoiceRequest>
{
    public CreateTuitionInvoiceRequestValidator()
    {
        RuleFor(x => x.StudentId).NotEmpty();
        RuleFor(x => x.PeriodYear).InclusiveBetween(2000, 2100);
        RuleFor(x => x.PeriodMonth).InclusiveBetween(1, 12);
        RuleFor(x => x.Amount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Note).MaximumLength(500);
    }
}

public sealed class UpdateTuitionInvoiceRequestValidator : AbstractValidator<UpdateTuitionInvoiceRequest>
{
    public UpdateTuitionInvoiceRequestValidator()
    {
        RuleFor(x => x.Amount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Note).MaximumLength(500);
    }
}
