using HungSilver.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HungSilver.Infrastructure.Persistence.Configurations;

public sealed class MonthlyEvaluationConfiguration : IEntityTypeConfiguration<MonthlyEvaluation>
{
    public void Configure(EntityTypeBuilder<MonthlyEvaluation> e)
    {
        e.Property(x => x.AttendanceScore).HasPrecision(5, 2);
        e.Property(x => x.HomeworkScore).HasPrecision(5, 2);
        e.Property(x => x.AttitudeScore).HasPrecision(5, 2);
        e.Property(x => x.VocabularyScore).HasPrecision(5, 2);
        e.Property(x => x.GrammarScore).HasPrecision(5, 2);
        e.Property(x => x.Comment).HasMaxLength(2000);
        e.HasIndex(x => new { x.StudentId, x.Year, x.Month });
    }
}

public sealed class MonthlyParentReportConfiguration : IEntityTypeConfiguration<MonthlyParentReport>
{
    public void Configure(EntityTypeBuilder<MonthlyParentReport> e)
    {
        e.Property(x => x.HomeworkCompletionPercent).HasPrecision(5, 2);
        // AssessmentText / Suggestion / GeneratedContent để kiểu text.
        e.HasIndex(x => new { x.StudentId, x.Year, x.Month });
    }
}
