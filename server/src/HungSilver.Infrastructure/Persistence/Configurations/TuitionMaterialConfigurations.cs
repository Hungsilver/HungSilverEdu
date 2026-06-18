using HungSilver.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HungSilver.Infrastructure.Persistence.Configurations;

public sealed class TuitionInvoiceConfiguration : IEntityTypeConfiguration<TuitionInvoice>
{
    public void Configure(EntityTypeBuilder<TuitionInvoice> e)
    {
        e.Property(x => x.Amount).HasPrecision(18, 2);
        e.Property(x => x.Note).HasMaxLength(500);
        e.HasIndex(x => x.StudentId);
        e.HasIndex(x => new { x.Status, x.DueDate });
    }
}

public sealed class LearningMaterialConfiguration : IEntityTypeConfiguration<LearningMaterial>
{
    public void Configure(EntityTypeBuilder<LearningMaterial> e)
    {
        e.Property(x => x.Title).HasMaxLength(200);
        e.Property(x => x.Url).HasMaxLength(1000);
        e.Property(x => x.Description).HasMaxLength(2000);
        e.Property(x => x.GradeBand).HasMaxLength(100);
        e.HasIndex(x => x.ClassId);
        e.HasIndex(x => x.CategoryId);
        e.HasIndex(x => x.GradeBand);
    }
}

public sealed class MaterialCategoryConfiguration : IEntityTypeConfiguration<MaterialCategory>
{
    public void Configure(EntityTypeBuilder<MaterialCategory> e)
    {
        e.Property(x => x.Name).HasMaxLength(150);
        e.Property(x => x.Description).HasMaxLength(500);
        e.HasIndex(x => x.SortOrder);
    }
}

public sealed class StoredFileConfiguration : IEntityTypeConfiguration<StoredFile>
{
    public void Configure(EntityTypeBuilder<StoredFile> e)
    {
        e.Property(x => x.FileName).HasMaxLength(260);
        e.Property(x => x.ContentType).HasMaxLength(200);
        e.Property(x => x.StoragePath).HasMaxLength(1000);
    }
}
