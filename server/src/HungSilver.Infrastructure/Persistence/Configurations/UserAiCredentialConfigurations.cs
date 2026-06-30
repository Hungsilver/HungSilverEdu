using HungSilver.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HungSilver.Infrastructure.Persistence.Configurations;

public sealed class UserAiCredentialConfiguration : IEntityTypeConfiguration<UserAiCredential>
{
    public void Configure(EntityTypeBuilder<UserAiCredential> e)
    {
        e.Property(x => x.Provider).HasMaxLength(40);
        e.Property(x => x.ApiKeyEncrypted).HasMaxLength(1024);
        e.Property(x => x.KeyLast4).HasMaxLength(8);
        e.Property(x => x.Model).HasMaxLength(80);
        // 1-1 tài khoản ↔ cấu hình AI: partial unique index trên UserId (đồng bộ Student/TeacherProfile).
        // Filter cú pháp chung hợp lệ cả Postgres lẫn SQLite.
        e.HasIndex(x => x.UserId).IsUnique().HasFilter("\"UserId\" IS NOT NULL AND NOT \"IsDeleted\"");
    }
}
