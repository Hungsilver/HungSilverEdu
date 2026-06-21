using FluentValidation;

namespace HungSilver.Application.Students;

public sealed class CreateStudentRequestValidator : AbstractValidator<CreateStudentRequest>
{
    public CreateStudentRequestValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.StudentCode).MaximumLength(20);
        RuleFor(x => x.School).MaximumLength(200);
        RuleFor(x => x.GradeLevel).MaximumLength(100);
        RuleFor(x => x.Phone).MaximumLength(20);
        RuleFor(x => x.ParentName).MaximumLength(200);
        RuleFor(x => x.ParentPhone).MaximumLength(20);
        RuleFor(x => x.Address).MaximumLength(500);
        RuleFor(x => x.Email).MaximumLength(256).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Note).MaximumLength(2000);
        RuleFor(x => x.EnglishLevel).MaximumLength(200);
        RuleFor(x => x.LearningGoal).MaximumLength(500);
        RuleFor(x => x.Curriculum).MaximumLength(500);
    }
}

public sealed class UpdateStudentRequestValidator : AbstractValidator<UpdateStudentRequest>
{
    public UpdateStudentRequestValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.StudentCode).MaximumLength(20);
        RuleFor(x => x.School).MaximumLength(200);
        RuleFor(x => x.GradeLevel).MaximumLength(100);
        RuleFor(x => x.Phone).MaximumLength(20);
        RuleFor(x => x.ParentName).MaximumLength(200);
        RuleFor(x => x.ParentPhone).MaximumLength(20);
        RuleFor(x => x.Address).MaximumLength(500);
        RuleFor(x => x.Email).MaximumLength(256).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Note).MaximumLength(2000);
        RuleFor(x => x.EnglishLevel).MaximumLength(200);
        RuleFor(x => x.LearningGoal).MaximumLength(500);
        RuleFor(x => x.Curriculum).MaximumLength(500);
    }
}
