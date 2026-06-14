using HungSilver.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HungSilver.Infrastructure.Persistence.Configurations;

public sealed class StudentConfiguration : IEntityTypeConfiguration<Student>
{
    public void Configure(EntityTypeBuilder<Student> e)
    {
        e.Property(x => x.FullName).HasMaxLength(200);
        e.Property(x => x.School).HasMaxLength(200);
        e.Property(x => x.GradeLevel).HasMaxLength(100);
        e.Property(x => x.Phone).HasMaxLength(20);
        e.Property(x => x.ParentName).HasMaxLength(200);
        e.Property(x => x.ParentPhone).HasMaxLength(20);
        e.Property(x => x.Address).HasMaxLength(500);
        e.Property(x => x.EnglishLevel).HasMaxLength(200);
        e.Property(x => x.LearningGoal).HasMaxLength(500);
        e.Property(x => x.Curriculum).HasMaxLength(500);
        e.Property(x => x.EntryScore).HasPrecision(5, 2);
        e.HasIndex(x => x.UserId);
        e.HasIndex(x => x.IsActive);
    }
}

public sealed class CurriculumConfiguration : IEntityTypeConfiguration<Curriculum>
{
    public void Configure(EntityTypeBuilder<Curriculum> e)
    {
        e.Property(x => x.Name).HasMaxLength(200);
        e.Property(x => x.Level).HasMaxLength(100);
        e.Property(x => x.Description).HasMaxLength(2000);
    }
}

public sealed class EnrollmentConfiguration : IEntityTypeConfiguration<Enrollment>
{
    public void Configure(EntityTypeBuilder<Enrollment> e)
    {
        e.HasIndex(x => x.ClassId);
        e.HasIndex(x => x.StudentId);
        // Tính duy nhất (StudentId, ClassId) còn hiệu lực được kiểm ở tầng app (vì soft-delete).
    }
}

public sealed class StudentAssessmentConfiguration : IEntityTypeConfiguration<StudentAssessment>
{
    public void Configure(EntityTypeBuilder<StudentAssessment> e)
    {
        e.Property(x => x.OverallScore).HasPrecision(5, 2);
        e.Property(x => x.Vocabulary).HasPrecision(5, 2);
        e.Property(x => x.Grammar).HasPrecision(5, 2);
        e.Property(x => x.Listening).HasPrecision(5, 2);
        e.Property(x => x.Speaking).HasPrecision(5, 2);
        e.Property(x => x.Reading).HasPrecision(5, 2);
        e.Property(x => x.Writing).HasPrecision(5, 2);
        e.Property(x => x.Notes).HasMaxLength(2000);
        e.HasIndex(x => x.StudentId);
    }
}
