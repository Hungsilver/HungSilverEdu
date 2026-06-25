using FluentValidation;

namespace HungSilver.Application.Teachers;

public sealed class CreateTeacherRequestValidator : AbstractValidator<CreateTeacherRequest>
{
    public CreateTeacherRequestValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.TeacherCode).MaximumLength(30);
        RuleFor(x => x.Phone).MaximumLength(20);
        RuleFor(x => x.Email).MaximumLength(256).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Address).MaximumLength(500);
        RuleFor(x => x.Note).MaximumLength(2000);
    }
}

public sealed class UpdateTeacherRequestValidator : AbstractValidator<UpdateTeacherRequest>
{
    public UpdateTeacherRequestValidator()
    {
        RuleFor(x => x.TeacherCode).NotEmpty().MaximumLength(30);
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Phone).MaximumLength(20);
        RuleFor(x => x.Email).MaximumLength(256).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Address).MaximumLength(500);
        RuleFor(x => x.Note).MaximumLength(2000);
    }
}

public sealed class CreateTeacherAccountRequestValidator : AbstractValidator<CreateTeacherAccountRequest>
{
    public CreateTeacherAccountRequestValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        // Tên đăng nhập = Mã giáo viên (tự sinh) ⇒ không nhập tay. Mật khẩu trống ⇒ dùng mặc định.
        RuleFor(x => x.Password).MinimumLength(8).When(x => !string.IsNullOrWhiteSpace(x.Password));
        RuleFor(x => x.LoginEmail).MaximumLength(256).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.LoginEmail));
    }
}
