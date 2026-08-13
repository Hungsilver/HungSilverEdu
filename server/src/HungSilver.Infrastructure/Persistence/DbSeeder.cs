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
    /// Áp migrations + seed dữ liệu tối thiểu để vận hành thật: roles (Admin/Teacher/User),
    /// cấu hình hệ thống mặc định, và tự tạo tài khoản Admin nếu chưa có (đọc từ env
    /// Admin__Username / Admin__Password). Gọi khi app khởi động.
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

        // Cấu hình mặc định (scope System) — seed TỪNG khóa nếu thiếu (idempotent), để DB cũ
        // vẫn nhận được khóa mới thêm về sau mà không phải xóa bảng.
        var existingKeys = await context.Settings
            .Where(s => s.Scope == SettingScope.System)
            .Select(s => s.Key)
            .ToListAsync();
        var missing = SettingKeys.Defaults.Where(kv => !existingKeys.Contains(kv.Key)).ToList();
        if (missing.Count > 0)
        {
            foreach (var kv in missing)
                context.Settings.Add(new AppSetting { Key = kv.Key, Value = kv.Value, Scope = SettingScope.System });
            await context.SaveChangesAsync();
            logger.LogInformation("Seeded {Count} default settings: {Keys}", missing.Count, string.Join(", ", missing.Select(m => m.Key)));
        }

        // Dọn khóa đã bỏ (FileStorage.Mode, Account.LocalEmailDomain) để không còn hiện ở màn Cấu hình.
        var obsoleteKeys = SettingKeys.Obsolete.ToArray();
        var obsolete = await context.Settings
            .Where(s => obsoleteKeys.Contains(s.Key))
            .ToListAsync();
        if (obsolete.Count > 0)
        {
            context.Settings.RemoveRange(obsolete);
            await context.SaveChangesAsync();
            logger.LogInformation("Removed {Count} obsolete settings", obsolete.Count);
        }

        // Đảm bảo có row Khung Ca học (Schedule.Shifts) để màn Cấu hình chỉnh tay được — idempotent.
        // (Resolver vẫn fallback về Default nếu thiếu, đây chỉ tạo bản ghi có DataType=Json cho UI.)
        if (!await context.Settings.IgnoreQueryFilters().AnyAsync(x => x.Key == SettingKeys.ScheduleShifts))
        {
            context.Settings.Add(new AppSetting
            {
                Key = SettingKeys.ScheduleShifts,
                Value = SettingKeys.Defaults[SettingKeys.ScheduleShifts],
                Scope = SettingScope.System,
                DataType = "Json",
                Description = "Khung Ca học (mặc định + theo cơ sở)"
            });
            await context.SaveChangesAsync();
            logger.LogInformation("Seeded default Schedule.Shifts setting");
        }

        await SeedGradeCategoriesAsync(context, logger);
        await SeedPointReasonsAsync(context, logger);

        // Auto-seed tài khoản Admin nếu chưa có admin nào trong hệ thống.
        var userManager = services.GetRequiredService<UserManager<AppUser>>();
        var admins = await userManager.GetUsersInRoleAsync(AppRoles.Admin);
        if (admins.Count == 0)
        {
            var config = services.GetRequiredService<Microsoft.Extensions.Configuration.IConfiguration>();
            var adminUsername = config["Admin:Username"];
            var adminPassword = config["Admin:Password"];

            if (!string.IsNullOrWhiteSpace(adminUsername) && !string.IsNullOrWhiteSpace(adminPassword))
            {
                var admin = new AppUser
                {
                    UserName = adminUsername,
                    // Không sinh email ảo — tài khoản đăng nhập bằng username. Admin gốc cũng KHÔNG bị
                    // ép đổi mật khẩu (miễn trừ bootstrap, tránh tự khóa hệ thống khi cài đặt lần đầu).
                    Email = null,
                    FullName = "Administrator",
                    EmailConfirmed = true
                };

                var result = await userManager.CreateAsync(admin, adminPassword);
                if (result.Succeeded)
                {
                    await userManager.AddToRoleAsync(admin, AppRoles.Admin);
                    logger.LogInformation("Seeded admin account: {Username}", adminUsername);
                }
                else
                {
                    var errors = string.Join("; ", result.Errors.Select(e => e.Description));
                    logger.LogWarning("Failed to seed admin account: {Errors}", errors);
                }
            }
            else
            {
                logger.LogWarning("No admin account exists and Admin__Username / Admin__Password not configured in environment");
            }
        }
    }

    private static async Task SeedPointReasonsAsync(AppDbContext context, ILogger logger)
    {
        if (await context.PointReasons.IgnoreQueryFilters().AnyAsync())
            return;

        var defaults = new List<(string Label, int Points, PointReasonType Type, int IndexOrder)>
        {
            ("Trả lời đúng", 1, PointReasonType.Reward, 0),
            ("Hoạt động nhóm", 1, PointReasonType.Reward, 1),
            ("Thành tích xuất sắc", 2, PointReasonType.Reward, 2),
            ("Hoàn thành bài tập", 1, PointReasonType.Reward, 3),
            ("Phát biểu đúng", 1, PointReasonType.Reward, 4),
            ("Nói chuyện riêng", 1, PointReasonType.Penalty, 0),
            ("Không làm bài", 1, PointReasonType.Penalty, 1),
            ("Vi phạm nội quy", 2, PointReasonType.Penalty, 2),
            ("Đến muộn", 1, PointReasonType.Penalty, 3),
            ("Thiếu dụng cụ học tập", 1, PointReasonType.Penalty, 4)
        };

        foreach (var item in defaults)
        {
            context.PointReasons.Add(new PointReason
            {
                Label = item.Label,
                Points = item.Points,
                Type = item.Type,
                IndexOrder = item.IndexOrder,
                IsActive = true
            });
        }

        await context.SaveChangesAsync();
        logger.LogInformation("Seeded default point reasons");
    }

    private static async Task SeedGradeCategoriesAsync(AppDbContext context, ILogger logger)
    {
        var defaults = new List<(string Code, string Name, int IndexOrder)>
        {
            ("MAM_NON", "Mầm non", 0)
        };
        defaults.AddRange(Enumerable.Range(1, 12).Select(i => ($"KHOI_{i}", i.ToString(), i)));
        defaults.Add(("KHAC", "Khác", 99));

        var existingCodes = await context.GradeCategories.IgnoreQueryFilters()
            .Select(x => x.Code)
            .ToListAsync();
        var existing = existingCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var item in defaults)
        {
            if (existing.Contains(item.Code))
                continue;

            context.GradeCategories.Add(new GradeCategory
            {
                Code = item.Code,
                Name = item.Name,
                IndexOrder = item.IndexOrder,
                IsActive = true
            });
        }

        if (context.ChangeTracker.HasChanges())
        {
            await context.SaveChangesAsync();
            logger.LogInformation("Seeded default grade categories");
        }
    }

}
