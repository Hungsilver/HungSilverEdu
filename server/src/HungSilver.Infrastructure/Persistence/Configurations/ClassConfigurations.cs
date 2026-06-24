using HungSilver.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HungSilver.Infrastructure.Persistence.Configurations;

public sealed class BranchConfiguration : IEntityTypeConfiguration<Branch>
{
    public void Configure(EntityTypeBuilder<Branch> e)
    {
        e.Property(x => x.Code).HasMaxLength(20);
        e.Property(x => x.Name).HasMaxLength(200);
        e.Property(x => x.Address).HasMaxLength(500);
        e.Property(x => x.Phone).HasMaxLength(20);
        e.Property(x => x.TeacherCodePrefix).HasMaxLength(30);
        e.HasIndex(x => x.Code).IsUnique();
        e.HasIndex(x => x.IndexOrder);
    }
}

public sealed class GradeCategoryConfiguration : IEntityTypeConfiguration<GradeCategory>
{
    public void Configure(EntityTypeBuilder<GradeCategory> e)
    {
        e.Property(x => x.Code).HasMaxLength(50);
        e.Property(x => x.Name).HasMaxLength(100);
        e.HasIndex(x => x.Code).IsUnique();
        e.HasIndex(x => x.IndexOrder);
    }
}

public sealed class TeacherProfileConfiguration : IEntityTypeConfiguration<TeacherProfile>
{
    public void Configure(EntityTypeBuilder<TeacherProfile> e)
    {
        e.Property(x => x.TeacherCode).HasMaxLength(30);
        e.Property(x => x.FullName).HasMaxLength(200);
        e.Property(x => x.Phone).HasMaxLength(20);
        e.Property(x => x.Email).HasMaxLength(256);
        e.Property(x => x.Address).HasMaxLength(500);
        e.Property(x => x.Note).HasMaxLength(2000);
        e.HasIndex(x => x.TeacherCode).IsUnique();
        e.HasIndex(x => x.UserId).IsUnique().HasFilter("\"UserId\" IS NOT NULL AND NOT \"IsDeleted\"");
        e.HasIndex(x => x.FullName);
        e.HasIndex(x => x.BranchId);
    }
}

public sealed class ClassRoomConfiguration : IEntityTypeConfiguration<ClassRoom>
{
    public void Configure(EntityTypeBuilder<ClassRoom> e)
    {
        e.ToTable("Classes");
        e.Property(x => x.ClassCode).HasMaxLength(30);
        e.Property(x => x.Name).HasMaxLength(200);
        e.Property(x => x.TeacherName).HasMaxLength(200);
        e.Property(x => x.BranchCode).HasMaxLength(20);
        e.Property(x => x.BranchName).HasMaxLength(200);
        e.Property(x => x.SubjectName).HasMaxLength(150);
        e.Property(x => x.GradeName).HasMaxLength(100);
        e.Property(x => x.Schedule).HasMaxLength(500);
        e.Property(x => x.GradeBand).HasMaxLength(100);
        e.Property(x => x.TuitionFee).HasPrecision(18, 2);
        e.HasIndex(x => x.ClassCode).IsUnique();
        e.HasIndex(x => x.TeacherId);
        e.HasIndex(x => x.TeacherProfileId);
        e.HasIndex(x => x.BranchId);
        e.HasIndex(x => x.SubjectId);
        e.HasIndex(x => x.GradeBand);
        e.HasIndex(x => x.GradeId);
    }
}

public sealed class SubjectConfiguration : IEntityTypeConfiguration<Subject>
{
    public void Configure(EntityTypeBuilder<Subject> e)
    {
        e.Property(x => x.Code).HasMaxLength(50);
        e.Property(x => x.Name).HasMaxLength(150);
        e.Property(x => x.Description).HasMaxLength(500);
        e.HasIndex(x => x.Code).IsUnique();
        e.HasIndex(x => x.IndexOrder);
    }
}

public sealed class ClassScheduleSlotConfiguration : IEntityTypeConfiguration<ClassScheduleSlot>
{
    public void Configure(EntityTypeBuilder<ClassScheduleSlot> e)
    {
        e.HasIndex(x => x.ClassId);
    }
}

public sealed class ClassSessionConfiguration : IEntityTypeConfiguration<ClassSession>
{
    public void Configure(EntityTypeBuilder<ClassSession> e)
    {
        e.Property(x => x.Topic).HasMaxLength(500);
        e.HasIndex(x => x.ClassId);
        e.HasIndex(x => x.SessionDate);
    }
}
