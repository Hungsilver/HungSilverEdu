using HungSilver.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HungSilver.Infrastructure.Persistence.Configurations;

public sealed class ExamConfiguration : IEntityTypeConfiguration<Exam>
{
    public void Configure(EntityTypeBuilder<Exam> e)
    {
        e.Property(x => x.Title).HasMaxLength(300);
        e.Property(x => x.Description).HasMaxLength(2000);
        e.Property(x => x.GradeBand).HasMaxLength(100);
        e.Property(x => x.SubjectName).HasMaxLength(150);
        e.Property(x => x.Language).HasMaxLength(20);
        e.Property(x => x.TotalPoints).HasPrecision(6, 2);
        e.HasIndex(x => x.MaterialId);
        e.HasIndex(x => x.SubjectId);
    }
}

public sealed class ExamQuestionGroupConfiguration : IEntityTypeConfiguration<ExamQuestionGroup>
{
    public void Configure(EntityTypeBuilder<ExamQuestionGroup> e)
    {
        e.Property(x => x.Section).HasMaxLength(100);
        e.Property(x => x.ExerciseLabel).HasMaxLength(150);
        // Instruction/Passage để kiểu text (có thể dài) — không giới hạn length.
        e.HasIndex(x => x.ExamId);
    }
}

public sealed class ExamQuestionConfiguration : IEntityTypeConfiguration<ExamQuestion>
{
    public void Configure(EntityTypeBuilder<ExamQuestion> e)
    {
        // Stem/OptionsJson/AnswerJson/Explanation để kiểu text (JSON/nội dung dài).
        e.Property(x => x.Points).HasPrecision(6, 2);
        e.HasIndex(x => x.ExamId);
        e.HasIndex(x => x.GroupId);
    }
}
