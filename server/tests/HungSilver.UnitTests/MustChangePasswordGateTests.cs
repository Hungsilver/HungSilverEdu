using System.Security.Claims;
using System.Text.Json;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>
/// Chặn THẬT ở server khi tài khoản chưa đổi mật khẩu lần đầu.
/// Trước đây việc ép đổi chỉ nằm ở guard phía giao diện — gọi thẳng API bằng access token vẫn qua.
/// </summary>
public sealed class MustChangePasswordGateTests
{
    [Theory]
    [InlineData("GET", "/api/students")]
    [InlineData("POST", "/api/exams/generate/00000000-0000-0000-0000-000000000001")]
    [InlineData("GET", "/api/settings/effective")]
    public async Task FlaggedUser_IsBlockedOnBusinessEndpoints(string method, string path)
    {
        var context = Context(method, path, mustChange: true);
        var nextCalled = false;

        await Invoke(context, () => { nextCalled = true; });

        Assert.False(nextCalled);
        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);

        var body = await ReadBodyAsync(context);
        Assert.Contains("đổi mật khẩu", body, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("PUT", "/api/profile/password")]   // chính lối để thoát ra
    [InlineData("GET", "/api/auth/me")]
    [InlineData("POST", "/api/auth/refresh")]
    [InlineData("POST", "/api/auth/logout")]
    public async Task FlaggedUser_CanStillReachAllowedEndpoints(string method, string path)
    {
        var context = Context(method, path, mustChange: true);
        var nextCalled = false;

        await Invoke(context, () => { nextCalled = true; });

        Assert.True(nextCalled);
        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
    }

    [Fact]
    public async Task UserWithoutFlag_PassesThrough()
    {
        var context = Context("GET", "/api/students", mustChange: false);
        var nextCalled = false;

        await Invoke(context, () => { nextCalled = true; });

        Assert.True(nextCalled);
    }

    [Fact]
    public async Task AnonymousRequest_PassesThrough()
    {
        // Chưa đăng nhập ⇒ để [Authorize] xử lý, middleware này không can thiệp.
        var context = new DefaultHttpContext();
        context.Request.Method = "POST";
        context.Request.Path = "/api/auth/login";
        context.Response.Body = new MemoryStream();
        var nextCalled = false;

        await Invoke(context, () => { nextCalled = true; });

        Assert.True(nextCalled);
    }

    private static Task Invoke(HttpContext context, Action onNext)
    {
        var middleware = new MustChangePasswordMiddleware(_ =>
        {
            onNext();
            return Task.CompletedTask;
        });
        return middleware.InvokeAsync(context);
    }

    private static DefaultHttpContext Context(string method, string path, bool mustChange)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()) };
        if (mustChange) claims.Add(new Claim(MustChangePasswordMiddleware.ClaimType, "1"));

        return new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")),
            Request = { Method = method, Path = path },
            Response = { Body = new MemoryStream() }
        };
    }

    private static async Task<string> ReadBodyAsync(HttpContext context)
    {
        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body);
        var raw = await reader.ReadToEndAsync();
        // Body là ApiResponse chuẩn ⇒ đọc message cho chắc format không đổi.
        using var doc = JsonDocument.Parse(raw);
        return doc.RootElement.GetProperty("message").GetString() ?? string.Empty;
    }
}
