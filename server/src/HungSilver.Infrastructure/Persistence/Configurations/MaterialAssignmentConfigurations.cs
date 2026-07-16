using HungSilver.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HungSilver.Infrastructure.Persistence.Configurations;

public sealed class MaterialAssignmentConfiguration : IEntityTypeConfiguration<MaterialAssignment>
{
    public void Configure(EntityTypeBuilder<MaterialAssignment> e)
    {
        e.Property(x => x.MaterialTitle).HasMaxLength(300);
        e.Property(x => x.Note).HasMaxLength(1000);
        e.HasIndex(x => x.ClassId);
        e.HasIndex(x => x.ClassSessionId);
        e.HasIndex(x => x.MaterialId);
    }
}

public sealed class MaterialAssignmentViewConfiguration : IEntityTypeConfiguration<MaterialAssignmentView>
{
    public void Configure(EntityTypeBuilder<MaterialAssignmentView> e)
    {
        e.HasIndex(x => x.StudentId);
        // 1 học viên chỉ 1 bản ghi "đã xem" cho 1 lượt giao (chống trùng do đua — mirror ExamAttempt).
        e.HasIndex(x => new { x.MaterialAssignmentId, x.StudentId }).IsUnique();
    }
}
