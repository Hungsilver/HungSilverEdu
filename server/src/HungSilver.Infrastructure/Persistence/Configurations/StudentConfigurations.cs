using HungSilver.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HungSilver.Infrastructure.Persistence.Configurations;

public sealed class StudentConfiguration : IEntityTypeConfiguration<Student>
{
    public void Configure(EntityTypeBuilder<Student> e)
    {
        e.Property(x => x.StudentCode).HasMaxLength(20);
        e.HasIndex(x => x.StudentCode).IsUnique();
        e.Property(x => x.FullName).HasMaxLength(200);
        e.Property(x => x.School).HasMaxLength(200);
        e.Property(x => x.GradeLevel).HasMaxLength(100);
        e.Property(x => x.Phone).HasMaxLength(20);
        e.Property(x => x.ParentName).HasMaxLength(200);
        e.Property(x => x.ParentPhone).HasMaxLength(20);
        e.Property(x => x.Address).HasMaxLength(500);
        e.Property(x => x.Email).HasMaxLength(256);
        e.Property(x => x.Note).HasMaxLength(2000);
        e.Property(x => x.EnglishLevel).HasMaxLength(200);
        e.Property(x => x.LearningGoal).HasMaxLength(500);
        e.Property(x => x.Curriculum).HasMaxLength(500);
        e.Property(x => x.EntryScore).HasPrecision(5, 2);
        // 1-1 học sinh ↔ tài khoản: partial unique index trên UserId (đồng bộ TeacherProfile).
        // Filter cú pháp chung hợp lệ cả Postgres lẫn SQLite (giống Enrollment active unique).
        e.HasIndex(x => x.UserId).IsUnique().HasFilter("\"UserId\" IS NOT NULL AND NOT \"IsDeleted\"");
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
        // Duy nhất (StudentId, ClassId) cho ghi danh CÒN HIỆU LỰC (chưa xóa mềm & đang active) —
        // partial unique index. Filter dùng cú pháp chung hợp lệ trên cả Postgres lẫn SQLite
        // (cột bool/integer + NOT). Tầng app vẫn kiểm trước để trả lỗi nghiệp vụ thân thiện.
        e.HasIndex(x => new { x.StudentId, x.ClassId })
            .IsUnique()
            .HasFilter("\"IsActive\" AND NOT \"IsDeleted\"");
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
