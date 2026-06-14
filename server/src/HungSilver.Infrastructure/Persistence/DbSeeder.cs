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

        // Giáo viên demo (role Teacher).
        var teacher = await userManager.FindByEmailAsync(seedOptions.TeacherEmail);
        if (teacher is null)
        {
            teacher = new AppUser
            {
                UserName = seedOptions.TeacherEmail,
                Email = seedOptions.TeacherEmail,
                EmailConfirmed = true,
                FullName = seedOptions.TeacherFullName
            };
            var createdTeacher = await userManager.CreateAsync(teacher, seedOptions.TeacherPassword);
            if (createdTeacher.Succeeded)
            {
                await userManager.AddToRoleAsync(teacher, AppRoles.Teacher);
                logger.LogInformation("Seeded teacher account {Email}", seedOptions.TeacherEmail);
            }
            else
            {
                logger.LogError("Seed teacher failed: {Errors}",
                    string.Join(" | ", createdTeacher.Errors.Select(e => e.Description)));
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

        // Cấu hình mặc định (scope System).
        if (!await context.Settings.IgnoreQueryFilters().AnyAsync())
        {
            foreach (var kv in SettingKeys.Defaults)
                context.Settings.Add(new AppSetting { Key = kv.Key, Value = kv.Value, Scope = SettingScope.System });
            await context.SaveChangesAsync();
            logger.LogInformation("Seeded default settings");
        }

        // Dữ liệu nghiệp vụ demo.
        if (teacher is not null && !await context.Classes.IgnoreQueryFilters().AnyAsync())
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

            var curriculum = new Curriculum { Name = "Movers", Level = "Pre-A1", Description = "Cambridge Movers" };
            context.Curriculums.Add(curriculum);

            var cls = new ClassRoom
            {
                Name = "Movers A",
                TeacherId = teacher.Id,
                CurriculumId = curriculum.Id,
                MaxCapacity = 15,
                Schedule = "Thứ 2, 4 - 19:00",
                StartDate = today,
                IsActive = true
            };
            context.Classes.Add(cls);

            var students = new[]
            {
                new Student { FullName = "Nguyễn Văn Nam", EnrollmentDate = today, EnglishLevel = "Movers", LearningGoal = "Thi đỗ lớp chuyên Anh", ParentName = "Nguyễn Văn A", ParentPhone = "0900000001", Phone = "0900000011", IsActive = true },
                new Student { FullName = "Trần Thị Lan", EnrollmentDate = today, EnglishLevel = "Movers", LearningGoal = "IELTS 6.5", ParentName = "Trần Văn B", ParentPhone = "0900000002", IsActive = true },
                new Student { FullName = "Lê Minh", EnrollmentDate = today, EnglishLevel = "Movers", ParentName = "Lê Văn C", ParentPhone = "0900000003", IsActive = true }
            };
            context.Students.AddRange(students);

            foreach (var s in students)
                context.Enrollments.Add(new Enrollment { ClassId = cls.Id, StudentId = s.Id, EnrolledOn = today, IsActive = true });

            context.ClassScheduleSlots.Add(new ClassScheduleSlot { ClassId = cls.Id, DayOfWeek = DayOfWeek.Monday, StartTime = new TimeOnly(19, 0), EndTime = new TimeOnly(20, 30) });
            context.ClassScheduleSlots.Add(new ClassScheduleSlot { ClassId = cls.Id, DayOfWeek = DayOfWeek.Wednesday, StartTime = new TimeOnly(19, 0), EndTime = new TimeOnly(20, 30) });

            context.ClassSessions.Add(new ClassSession
            {
                ClassId = cls.Id,
                SessionNumber = 1,
                SessionDate = today,
                StartTime = new TimeOnly(19, 0),
                EndTime = new TimeOnly(20, 30),
                Topic = "Unit 1: My Family",
                Status = SessionStatus.Scheduled
            });

            await context.SaveChangesAsync();
            logger.LogInformation("Seeded demo teaching data");
        }
    }
}
