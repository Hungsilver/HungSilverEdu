using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Common;

/// <summary>Chốt chặn cuối: exception chưa xử lý → log + ProblemDetails 500, không lộ stack trace.</summary>
public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        logger.LogError(exception, "Unhandled exception at {Path}", httpContext.Request.Path);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await httpContext.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "Server.Error",
            Detail = "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau."
        }, cancellationToken);

        return true;
    }
}
