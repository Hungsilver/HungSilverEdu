using HungSilver.Application.Abstractions;
using HungSilver.Application.Account;
using HungSilver.Application.Accounts;
using HungSilver.Application.Assignments;
using HungSilver.Application.Auth;
using HungSilver.Application.Files;
using HungSilver.Application.Common;
using HungSilver.Application.Settings;
using HungSilver.Application.Users;
using HungSilver.Application.Classes;
using HungSilver.Application.Dashboard;
using HungSilver.Application.Evaluations;
using HungSilver.Application.Notifications;
using HungSilver.Application.Portal;
using HungSilver.Application.Reports;
using HungSilver.Application.Schedule;
using HungSilver.Application.Sessions;
using HungSilver.Application.Students;
using HungSilver.Application.Teachers;
using HungSilver.Application.Tuition;
using HungSilver.Application.Warnings;
using HungSilver.Infrastructure.Accounts;
using HungSilver.Infrastructure.Assignments;
using HungSilver.Infrastructure.Auth;
using HungSilver.Infrastructure.Classes;
using HungSilver.Infrastructure.Common;
using HungSilver.Infrastructure.Dashboard;
using HungSilver.Infrastructure.Evaluations;
using HungSilver.Infrastructure.Identity;
using HungSilver.Infrastructure.Account;
using HungSilver.Infrastructure.Notifications;
using HungSilver.Infrastructure.Reports;
using HungSilver.Infrastructure.Portal;
using HungSilver.Infrastructure.Schedule;
using HungSilver.Infrastructure.Sessions;
using HungSilver.Infrastructure.Tuition;
using HungSilver.Infrastructure.Warnings;
using HungSilver.Infrastructure.Persistence;
using HungSilver.Infrastructure.Persistence.Interceptors;
using HungSilver.Infrastructure.Persistence.Repositories;
using HungSilver.Infrastructure.Services;
using HungSilver.Infrastructure.Settings;
using HungSilver.Infrastructure.Storage;
using HungSilver.Infrastructure.Students;
using HungSilver.Infrastructure.Teachers;
using HungSilver.Infrastructure.Users;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HungSilver.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.Configure<GoogleOptions>(configuration.GetSection(GoogleOptions.SectionName));
        services.Configure<AuthFeatureOptions>(configuration.GetSection(AuthFeatureOptions.SectionName));
        services.Configure<FileStorageOptions>(configuration.GetSection(FileStorageOptions.SectionName));
        services.Configure<SmtpOptions>(configuration.GetSection(SmtpOptions.SectionName));

        services.AddSingleton<AuditSaveChangesInterceptor>();

        services.AddDbContext<AppDbContext>((sp, options) =>
            options.UseNpgsql(configuration.GetConnectionString("Default"))
                .AddInterceptors(sp.GetRequiredService<AuditSaveChangesInterceptor>()));

        services.AddIdentityCore<AppUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Password.RequiredLength = 8;
                options.Password.RequireNonAlphanumeric = false;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
            })
            .AddRoles<AppRole>()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddSignInManager()
            .AddDefaultTokenProviders();

        services.AddHttpContextAccessor();

        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<ICurrentRelationCleanupService, CurrentRelationCleanupService>();

        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IGoogleAuthVerifier, GoogleAuthVerifier>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserAdminService, UserAdminService>();
        services.AddScoped<IAccountProvisioningService, AccountProvisioningService>();
        services.AddScoped<ICurrentUser, CurrentUser>();
        services.AddScoped<IUserDirectory, UserDirectory>();

        // File storage + cấu hình phân tầng
        services.AddScoped<IFileStorage, LocalDiskFileStorage>();
        services.AddScoped<IFileService, FileService>();
        services.AddHostedService<FileCleanupService>(); // dọn file đã xóa mềm quá hạn
        services.AddScoped<IProfileService, ProfileService>();
        services.AddScoped<SettingsService>();
        services.AddScoped<ISettingsService>(sp => sp.GetRequiredService<SettingsService>());
        services.AddScoped<ISettingsResolver>(sp => sp.GetRequiredService<SettingsService>());

        // Service nghiệp vụ (Infrastructure)
        services.AddScoped<IClassService, ClassService>();
        services.AddScoped<IScheduleService, ScheduleService>();
        services.AddScoped<ISessionService, SessionService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<ISessionReportService, SessionReportService>();
        services.AddScoped<ITuitionService, TuitionService>();
        services.AddScoped<IEvaluationService, EvaluationService>();
        services.AddScoped<IParentReportService, ParentReportService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IWarningsService, WarningsService>();
        services.AddScoped<IPortalService, PortalService>();
        services.AddScoped<IAssignmentService, AssignmentService>();
        services.AddScoped<IStudentImportService, StudentImportService>();
        services.AddScoped<IStudentAccountService, StudentAccountService>();
        services.AddScoped<IClassImportService, ClassImportService>();
        services.AddScoped<ITeacherService, TeacherService>();

        // Thông báo: Email gửi thật (MailKit); Zalo/Messenger stub (gửi tay).
        services.AddScoped<INotificationSender, EmailNotificationSender>();
        services.AddScoped<INotificationSender, ZaloNotificationSender>();
        services.AddScoped<INotificationSender, MessengerNotificationSender>();
        services.AddScoped<INotificationDispatcher, NotificationDispatcher>();

        return services;
    }
}
