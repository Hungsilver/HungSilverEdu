using System.Text;
using System.Threading.RateLimiting;
using HungSilver.Application;
using HungSilver.Domain.Common;
using HungSilver.Infrastructure;
using HungSilver.Infrastructure.Auth;
using HungSilver.Infrastructure.Persistence;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using Serilog;

// Cho phép Npgsql chấp nhận DateTime.Now (Local kind) với cột "timestamp with time zone"
// vì hệ thống chạy trên VPS cùng múi giờ, không cần UTC.
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, config) => config
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console());

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
                 ?? throw new InvalidOperationException("Thiếu cấu hình Jwt.");
if (string.IsNullOrWhiteSpace(jwtOptions.Secret) || jwtOptions.Secret.Length < 32)
    throw new InvalidOperationException("Jwt:Secret phải có tối thiểu 32 ký tự (set qua env Jwt__Secret).");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Secret)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = "sub",
            RoleClaimType = "role"
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole(AppRoles.Admin));
    options.AddPolicy("TeacherOrAdmin", policy => policy.RequireRole(AppRoles.Admin, AppRoles.Teacher));
});

// Rate limit upload theo user (chống nhồi file): 30 lần / phút / user.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("upload", httpContext =>
    {
        var key = httpContext.User.FindFirst("sub")?.Value
                  ?? httpContext.Connection.RemoteIpAddress?.ToString()
                  ?? "anon";
        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 30,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        });
    });
});

var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddPolicy("Client", policy => policy
    .WithOrigins(corsOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

builder.Services
    .AddControllers(options => options.Filters.Add<ApiResponseWrapperFilter>())
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>();

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseExceptionHandler();
app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(); // UI tài liệu API tại /scalar/v1
}

app.UseCors("Client");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();
app.MapHealthChecks("/health");

await DbSeeder.MigrateAndSeedAsync(app.Services);

app.Run();
