using FluentValidation.Results;
using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Common;

public static class ValidationExtensions
{
    public static Error ToError(this ValidationResult result, string code = "Validation.Failed") =>
        Error.Validation(code, string.Join(" | ", result.Errors.Select(e => e.ErrorMessage)));
}
