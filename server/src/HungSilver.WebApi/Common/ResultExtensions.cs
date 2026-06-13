using HungSilver.Domain.Common.Results;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Common;

/// <summary>Map Result pattern → HTTP response (ProblemDetails khi lỗi).</summary>
public static class ResultExtensions
{
    public static ActionResult ToActionResult(this Result result) =>
        result.IsSuccess ? new NoContentResult() : result.Error.ToProblemResult();

    public static ActionResult ToActionResult<T>(this Result<T> result) =>
        result.IsSuccess ? new OkObjectResult(result.Value) : result.Error.ToProblemResult();

    public static ObjectResult ToProblemResult(this Error error)
    {
        var statusCode = error.Type switch
        {
            ErrorType.Validation => StatusCodes.Status400BadRequest,
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            ErrorType.Unauthorized => StatusCodes.Status401Unauthorized,
            ErrorType.Forbidden => StatusCodes.Status403Forbidden,
            _ => StatusCodes.Status500InternalServerError
        };

        return new ObjectResult(new ProblemDetails
        {
            Status = statusCode,
            Title = error.Code,
            Detail = error.Message
        })
        {
            StatusCode = statusCode
        };
    }
}
