using HungSilver.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HungSilver.Infrastructure.Persistence.Configurations;

public sealed class StudentSessionRecordConfiguration : IEntityTypeConfiguration<StudentSessionRecord>
{
    public void Configure(EntityTypeBuilder<StudentSessionRecord> e)
    {
        e.Property(x => x.PersonalNote).HasMaxLength(2000);
        e.HasIndex(x => new { x.ClassSessionId, x.StudentId });
    }
}

public sealed class PointEntryConfiguration : IEntityTypeConfiguration<PointEntry>
{
    public void Configure(EntityTypeBuilder<PointEntry> e)
    {
        e.Property(x => x.Reason).HasMaxLength(200);
        e.HasIndex(x => x.StudentId);
        e.HasIndex(x => x.ClassSessionId);
    }
}

public sealed class RewardRedemptionConfiguration : IEntityTypeConfiguration<RewardRedemption>
{
    public void Configure(EntityTypeBuilder<RewardRedemption> e)
    {
        e.Property(x => x.Note).HasMaxLength(500);
        e.HasIndex(x => x.StudentId);
    }
}

public sealed class TeacherJournalConfiguration : IEntityTypeConfiguration<TeacherJournal>
{
    public void Configure(EntityTypeBuilder<TeacherJournal> e)
    {
        e.Property(x => x.ContentTaught).HasMaxLength(2000);
        e.Property(x => x.Activities).HasMaxLength(2000);
        e.Property(x => x.Difficulties).HasMaxLength(2000);
        e.Property(x => x.NotesForNextSession).HasMaxLength(2000);
        e.HasIndex(x => x.ClassSessionId);
    }
}

public sealed class SessionReportConfiguration : IEntityTypeConfiguration<SessionReport>
{
    public void Configure(EntityTypeBuilder<SessionReport> e)
    {
        // GeneratedContent để kiểu text (không giới hạn).
        e.HasIndex(x => x.ClassSessionId);
    }
}
