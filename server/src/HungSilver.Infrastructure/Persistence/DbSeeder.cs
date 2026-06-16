using HungSilver.Application.Settings;
using HungSilver.Domain.Common;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Auth;
using HungSilver.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HungSilver.Infrastructure.Persistence;

public static class DbSeeder
{
    /// <summary>
    /// Áp migrations + seed dữ liệu tối thiểu để vận hành thật: roles, 1 tài khoản admin và
    /// cấu hình hệ thống mặc định. KHÔNG seed dữ liệu demo (giáo viên/lớp/học sinh/sản phẩm) —
    /// admin tự tạo giáo viên, giáo viên tự tạo lớp & học sinh. Gọi khi app khởi động.
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

        var seedOptions = services.GetRequiredService<IOptions<SeedOptions>>().Value;
        var userManager = services.GetRequiredService<UserManager<AppUser>>();

        // Tài khoản admin duy nhất — đăng nhập bằng username (vd "admin").
        var admin = await userManager.FindByNameAsync(seedOptions.AdminUserName);
        if (admin is null)
        {
            admin = new AppUser
            {
                UserName = seedOptions.AdminUserName,
                Email = seedOptions.AdminEmail,
                EmailConfirmed = true,
                FullName = seedOptions.AdminFullName
            };

            var created = await userManager.CreateAsync(admin, seedOptions.AdminPassword);
            if (created.Succeeded)
            {
                await userManager.AddToRoleAsync(admin, AppRoles.Admin);
                logger.LogInformation("Seeded admin account {UserName}", seedOptions.AdminUserName);
            }
            else
            {
                logger.LogError("Seed admin failed: {Errors}",
                    string.Join(" | ", created.Errors.Select(e => e.Description)));
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
