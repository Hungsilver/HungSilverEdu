using Microsoft.AspNetCore.Diagnostics;

namespace HungSilver.WebApi.Common;

/// <summary>Chốt chặn cuối: exception chưa xử lý → log + ApiResponse 500, không lộ stack trace.</summary>
public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        logger.LogError(exception, "Unhandled exception at {Path}", httpContext.Request.Path);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await httpContext.Response.WriteAsJsonAsync(
            ApiResponse.Fail("Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.", 500),
            cancellationToken);

        return true;
    }
}
