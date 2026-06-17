using HungSilver.Application.Settings;
using HungSilver.Domain.Common;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace HungSilver.Infrastructure.Persistence;

public static class DbSeeder
{
    /// <summary>
    /// Áp migrations + seed dữ liệu tối thiểu để vận hành thật: roles (Admin/Teacher/User)
    /// và cấu hình hệ thống mặc định. KHÔNG tự tạo tài khoản admin (tạo thủ công khi cần)
    /// và KHÔNG seed dữ liệu demo. Gọi khi app khởi động.
    /// </summary>
    public static async Task MigrateAndSeedAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var services = scope.ServiceProvider;
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger("DbSeeder");

        var context = services.GetRequiredService<AppDbContext>();
        await context.Database.MigrateAsync();

        var roleManager = services.GetRequiredService<RoleManager<AppRole>>();
        foreach (var roleName in AppRoles.All)
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                await roleManager.CreateAsync(new AppRole(roleName));
                logger.LogInformation("Seeded role {Role}", roleName);
            }
        }

        // Cấu hình mặc định (scope System). Vận hành thật ⇒ cho upload file lên server.
        if (!await context.Settings.IgnoreQueryFilters().AnyAsync())
        {
            foreach (var kv in SettingKeys.Defaults)
            {
                var value = kv.Key == SettingKeys.FileStorageMode
                    ? nameof(FileStorageMode.Server)
                    : kv.Value;
                context.Settings.Add(new AppSetting { Key = kv.Key, Value = value, Scope = SettingScope.System });
            }
            await context.SaveChangesAsync();
            logger.LogInformation("Seeded default settings (FileStorage.Mode = Server)");
        }
    }
}
