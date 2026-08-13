using System.Net;
using System.Text.Json;

namespace HungSilver.WebApi.Common;

/// <summary>
/// Chặn THẬT ở server việc dùng hệ thống khi chưa đổi mật khẩu lần đầu.
/// <para>
/// Trước đây việc ép đổi chỉ nằm ở guard phía giao diện — gọi thẳng API bằng access token vẫn qua được.
/// Token của người chưa đổi mật khẩu mang claim <c>mcp</c> (xem <c>JwtTokenService</c>); middleware này
/// trả <b>403</b> cho mọi endpoint, chỉ chừa các lối cần thiết để người dùng đổi mật khẩu và thoát ra.
/// </para>
/// </summary>
public sealed class MustChangePasswordMiddleware(RequestDelegate next)
{
    public const string ClaimType = "mcp";

    /// <summary>Đường được phép đi khi đang bị bắt đổi mật khẩu: xem mình là ai, đổi mật khẩu, làm mới phiên, đăng xuất.</summary>
    private static readonly (string Method, string Path)[] Allowed =
    [
        ("PUT",  "/api/profile/password"),
        ("GET",  "/api/auth/me"),
        ("POST", "/api/auth/refresh"),
        ("POST", "/api/auth/logout"),
        ("POST", "/api/auth/login")
    ];

    public async Task InvokeAsync(HttpContext context)
    {
        var user = context.User;
        if (user?.Identity?.IsAuthenticated == true && user.HasClaim(c => c.Type == ClaimType))
        {
            var path = context.Request.Path.Value ?? string.Empty;
            var method = context.Request.Method;

            var allowed = Allowed.Any(a =>
                string.Equals(a.Method, method, StringComparison.OrdinalIgnoreCase) &&
                path.Equals(a.Path, StringComparison.OrdinalIgnoreCase));

            if (!allowed)
            {
                context.Response.StatusCode = (int)HttpStatusCode.Forbidden;
                context.Response.ContentType = "application/json; charset=utf-8";
                var body = ApiResponse.Fail(
                    "Bạn cần đổi mật khẩu trước khi sử dụng hệ thống.", (int)HttpStatusCode.Forbidden);
                await context.Response.WriteAsync(JsonSerializer.Serialize(body, JsonOptions));
                return;
            }
        }

        await next(context);
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
}

public static class MustChangePasswordMiddlewareExtensions
{
    /// <summary>Đặt SAU UseAuthentication (cần đọc claim) và TRƯỚC MapControllers.</summary>
    public static IApplicationBuilder UseMustChangePasswordGate(this IApplicationBuilder app) =>
        app.UseMiddleware<MustChangePasswordMiddleware>();
}
