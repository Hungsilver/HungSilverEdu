using HungSilver.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HungSilver.Infrastructure.Persistence.Configurations;

public sealed class ClassRoomConfiguration : IEntityTypeConfiguration<ClassRoom>
{
    public void Configure(EntityTypeBuilder<ClassRoom> e)
    {
        e.ToTable("Classes");
        e.Property(x => x.Name).HasMaxLength(200);
        e.Property(x => x.Schedule).HasMaxLength(500);
        e.Property(x => x.GradeBand).HasMaxLength(100);
        e.HasIndex(x => x.TeacherId);
        e.HasIndex(x => x.SubjectId);
        e.HasIndex(x => x.GradeBand);
    }
}

public sealed class SubjectConfiguration : IEntityTypeConfiguration<Subject>
{
    public void Configure(EntityTypeBuilder<Subject> e)
    {
        e.Property(x => x.Name).HasMaxLength(150);
        e.Property(x => x.Description).HasMaxLength(500);
        e.HasIndex(x => x.SortOrder);
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
