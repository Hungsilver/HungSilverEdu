using FluentValidation;

namespace HungSilver.Application.Evaluations;

public sealed class UpsertEvaluationRequestValidator : AbstractValidator<UpsertEvaluationRequest>
{
    public UpsertEvaluationRequestValidator()
    {
        RuleFor(x => x.StudentId).NotEmpty();
        RuleFor(x => x.Year).InclusiveBetween(2000, 2100);
        RuleFor(x => x.Month).InclusiveBetween(1, 12);
        RuleFor(x => x.AttendanceScore).InclusiveBetween(0, 10);
        RuleFor(x => x.HomeworkScore).InclusiveBetween(0, 10);
        RuleFor(x => x.AttitudeScore).InclusiveBetween(0, 10);
        RuleFor(x => x.VocabularyScore).InclusiveBetween(0, 10);
        RuleFor(x => x.GrammarScore).InclusiveBetween(0, 10);
        RuleFor(x => x.Comment).MaximumLength(2000);
    }
}
