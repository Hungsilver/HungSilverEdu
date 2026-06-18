using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace HungSilver.WebApi.Common;

/// <summary>
/// Bọc mọi response MVC trong ApiResponse { data, isSuccess, message, statusCode }.
/// Skip FileResult (download file).
/// </summary>
public sealed class ApiResponseWrapperFilter : IResultFilter
{
    public void OnResultExecuting(ResultExecutingContext context)
    {
        switch (context.Result)
        {
            // File download → không bọc
            case FileResult:
                return;

            // ObjectResult bao gồm OkObjectResult, BadRequestObjectResult, v.v.
            case ObjectResult objectResult:
                if (objectResult.Value is ProblemDetails problem)
                {
                    var status = problem.Status ?? objectResult.StatusCode ?? 500;
                    context.Result = new ObjectResult(ApiResponse.Fail(problem.Detail ?? problem.Title ?? "", status))
                    {
                        StatusCode = status
                    };
                }
                else
                {
                    var status = objectResult.StatusCode ?? 200;
                    context.Result = new ObjectResult(ApiResponse.Ok(objectResult.Value, status))
                    {
                        StatusCode = status
                    };
                }
                break;

            // NoContent (204) → trả 200 với data = null
            case NoContentResult:
                context.Result = new ObjectResult(ApiResponse.Ok<object>(null, 204))
                {
                    StatusCode = 200
                };
                break;

            // StatusCodeResult thuần (không có body)
            case StatusCodeResult statusResult:
                var code = statusResult.StatusCode;
                if (code >= 400)
                {
                    context.Result = new ObjectResult(ApiResponse.Fail("", code))
                    {
                        StatusCode = code
                    };
                }
                else
                {
                    context.Result = new ObjectResult(ApiResponse.Ok<object>(null, code))
                    {
                        StatusCode = code
                    };
                }
                break;
        }
    }

    public void OnResultExecuted(ResultExecutedContext context) { }
}
