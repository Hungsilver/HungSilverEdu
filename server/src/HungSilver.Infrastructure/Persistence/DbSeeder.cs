using HungSilver.Domain.Common;
using HungSilver.Domain.Entities;
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
    /// <summary>Áp migrations + seed roles, tài khoản admin và dữ liệu demo. Gọi khi app khởi động.</summary>
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

        var admin = await userManager.FindByEmailAsync(seedOptions.AdminEmail);
        if (admin is null)
        {
            admin = new AppUser
            {
                UserName = seedOptions.AdminEmail,
                Email = seedOptions.AdminEmail,
                EmailConfirmed = true,
                FullName = seedOptions.AdminFullName
            };

            var created = await userManager.CreateAsync(admin, seedOptions.AdminPassword);
            if (created.Succeeded)
            {
                await userManager.AddToRoleAsync(admin, AppRoles.Admin);
                logger.LogInformation("Seeded admin account {Email}", seedOptions.AdminEmail);
            }
            else
            {
                logger.LogError("Seed admin failed: {Errors}",
                    string.Join(" | ", created.Errors.Select(e => e.Description)));
            }
        }

        if (!await context.Products.IgnoreQueryFilters().AnyAsync())
        {
            context.Products.AddRange(
                new Product { Name = "Nhẫn bạc 925", Sku = "RING-925-001", Price = 350_000, Description = "Nhẫn bạc demo", IsActive = true },
                new Product { Name = "Dây chuyền bạc", Sku = "NECK-925-001", Price = 550_000, Description = "Dây chuyền demo", IsActive = true },
                new Product { Name = "Lắc tay bạc", Sku = "BRAC-925-001", Price = 450_000, Description = "Lắc tay demo", IsActive = false });

            await context.SaveChangesAsync();
            logger.LogInformation("Seeded demo products");
        }
    }
}
