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
    /// và cấu hình hệ thống mặc định. <b>TẠM THỜI</b> seed lại 1 tài khoản admin khi khởi chạy đầu
    /// (bootstrap — sẽ gỡ ở commit kế). KHÔNG seed dữ liệu demo. Gọi khi app khởi động.
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

        // ⚠️ TẠM THỜI — seed tài khoản admin lần đầu (bootstrap). XÓA KHỐI NÀY Ở COMMIT KẾ TIẾP
        // sau khi admin đã được tạo. Idempotent: chỉ tạo nếu 'admin' chưa tồn tại.
        // Đổi mật khẩu ngay sau lần đăng nhập đầu (trang Cá nhân).
        var userManager = services.GetRequiredService<UserManager<AppUser>>();
        if (await userManager.FindByNameAsync("admin") is null)
        {
            var admin = new AppUser
            {
                UserName = "admin",
                Email = "admin@gmail.com",
                EmailConfirmed = true,
                FullName = "Quản trị viên"
            };
            var created = await userManager.CreateAsync(admin, "Admin@a1");
            if (created.Succeeded)
            {
                await userManager.AddToRoleAsync(admin, AppRoles.Admin);
                logger.LogInformation("Seeded admin account (TẠM THỜI - bootstrap)");
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
