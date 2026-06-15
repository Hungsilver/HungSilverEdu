using HungSilver.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HungSilver.Infrastructure.Persistence.Configurations;

public sealed class AssignmentConfiguration : IEntityTypeConfiguration<Assignment>
{
    public void Configure(EntityTypeBuilder<Assignment> e)
    {
        e.Property(x => x.Title).HasMaxLength(200);
        e.Property(x => x.Instructions).HasMaxLength(2000);
        e.HasIndex(x => x.ClassId);
        e.HasIndex(x => x.ClassSessionId);
    }
}

public sealed class SubmissionConfiguration : IEntityTypeConfiguration<Submission>
{
    public void Configure(EntityTypeBuilder<Submission> e)
    {
        e.Property(x => x.Link).HasMaxLength(1000);
        e.Property(x => x.Note).HasMaxLength(1000);
        e.HasIndex(x => x.StudentId);
        // Mỗi học sinh chỉ có 1 bản ghi nộp cho 1 bài tập (chống trùng do race).
        e.HasIndex(x => new { x.AssignmentId, x.StudentId }).IsUnique();
    }
}
