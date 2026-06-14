using HungSilver.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HungSilver.Infrastructure.Persistence.Configurations;

public sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> e)
    {
        e.Property(x => x.Title).HasMaxLength(200);
        // Content để kiểu text.
        e.HasIndex(x => x.ClassId);
        e.HasIndex(x => x.StudentId);
    }
}

public sealed class NotificationDeliveryConfiguration : IEntityTypeConfiguration<NotificationDelivery>
{
    public void Configure(EntityTypeBuilder<NotificationDelivery> e)
    {
        e.Property(x => x.ErrorMessage).HasMaxLength(2000);
        // RenderedContent để kiểu text.
        e.HasIndex(x => x.NotificationId);
    }
}

public sealed class AppSettingConfiguration : IEntityTypeConfiguration<AppSetting>
{
    public void Configure(EntityTypeBuilder<AppSetting> e)
    {
        e.Property(x => x.Key).HasMaxLength(200);
        e.Property(x => x.DataType).HasMaxLength(100);
        e.Property(x => x.Description).HasMaxLength(500);
        // Value để kiểu text.
        e.HasIndex(x => new { x.Scope, x.ScopeId, x.Key });
    }
}
