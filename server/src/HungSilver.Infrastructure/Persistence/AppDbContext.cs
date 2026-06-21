using System.Linq.Expressions;
using HungSilver.Domain.Common;
using HungSilver.Domain.Entities;
using HungSilver.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AppUser, AppRole, Guid>(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    // Nghiệp vụ trung tâm (lớp ClassRoom map sang bảng "Classes").
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<GradeCategory> GradeCategories => Set<GradeCategory>();
    public DbSet<TeacherProfile> TeacherProfiles => Set<TeacherProfile>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<Curriculum> Curriculums => Set<Curriculum>();
    public DbSet<Subject> Subjects => Set<Subject>();
    public DbSet<ClassRoom> Classes => Set<ClassRoom>();
    public DbSet<Enrollment> Enrollments => Set<Enrollment>();
    public DbSet<ClassScheduleSlot> ClassScheduleSlots => Set<ClassScheduleSlot>();
    public DbSet<ClassSession> ClassSessions => Set<ClassSession>();
    public DbSet<StudentSessionRecord> StudentSessionRecords => Set<StudentSessionRecord>();
    public DbSet<PointEntry> PointEntries => Set<PointEntry>();
    public DbSet<RewardRedemption> RewardRedemptions => Set<RewardRedemption>();
    public DbSet<TeacherJournal> TeacherJournals => Set<TeacherJournal>();
    public DbSet<SessionReport> SessionReports => Set<SessionReport>();
    public DbSet<StudentAssessment> StudentAssessments => Set<StudentAssessment>();
    public DbSet<MonthlyEvaluation> MonthlyEvaluations => Set<MonthlyEvaluation>();
    public DbSet<MonthlyParentReport> MonthlyParentReports => Set<MonthlyParentReport>();
    public DbSet<TuitionInvoice> TuitionInvoices => Set<TuitionInvoice>();
    public DbSet<LearningMaterial> LearningMaterials => Set<LearningMaterial>();
    public DbSet<MaterialCategory> MaterialCategories => Set<MaterialCategory>();
    public DbSet<Assignment> Assignments => Set<Assignment>();
    public DbSet<Submission> Submissions => Set<Submission>();
    public DbSet<StoredFile> StoredFiles => Set<StoredFile>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<NotificationDelivery> NotificationDeliveries => Set<NotificationDelivery>();
    public DbSet<AppSetting> Settings => Set<AppSetting>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Product>(e =>
        {
            e.Property(p => p.Name).HasMaxLength(200);
            e.Property(p => p.Sku).HasMaxLength(50);
            e.Property(p => p.Description).HasMaxLength(2000);
            e.Property(p => p.Price).HasPrecision(18, 2);
            e.HasIndex(p => p.Sku);
        });

        builder.Entity<RefreshToken>(e =>
        {
            e.Property(t => t.TokenHash).HasMaxLength(128);
            e.Property(t => t.ReplacedByTokenHash).HasMaxLength(128);
            e.HasIndex(t => t.TokenHash);
            e.HasOne<AppUser>().WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        // Cấu hình các entity nghiệp vụ (IEntityTypeConfiguration) — KHÔNG khai báo khóa ngoại.
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // Tự gắn global query filter "IsDeleted = false" cho MỌI entity ISoftDeletable
        // (gồm cả bảng Users) — đảm bảo xóa mềm áp dụng nhất quán toàn hệ thống.
        // PHẢI giữ vòng lặp này ở cuối OnModelCreating để áp cho cả entity mới.
        foreach (var entityType in builder.Model.GetEntityTypes())
        {
            if (!typeof(ISoftDeletable).IsAssignableFrom(entityType.ClrType))
                continue;

            var parameter = Expression.Parameter(entityType.ClrType, "e");
            var filter = Expression.Lambda(
                Expression.Equal(
                    Expression.Property(parameter, nameof(ISoftDeletable.IsDeleted)),
                    Expression.Constant(false)),
                parameter);

            builder.Entity(entityType.ClrType).HasQueryFilter(filter);
        }
    }
}
