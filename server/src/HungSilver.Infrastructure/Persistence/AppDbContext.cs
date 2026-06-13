using System.Linq.Expressions;
using HungSilver.Domain.Common;
using HungSilver.Domain.Entities;
using HungSilver.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AppUser, AppRole, Guid>(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Product>(e =>
        {
            e.Property(p => p.Name).HasMaxLength(200);
            e.Property(p => p.Sku).HasMaxLength(50);
            e.Property(p => p.Description).HasMaxLength(2000);
            e.Property(p => p.Price).HasPrecision(18, 2);
            e.HasIndex(p => p.Sku);
        });

        builder.Entity<RefreshToken>(e =>
        {
            e.Property(t => t.TokenHash).HasMaxLength(128);
            e.Property(t => t.ReplacedByTokenHash).HasMaxLength(128);
            e.HasIndex(t => t.TokenHash);
            e.HasOne<AppUser>().WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        // Tự gắn global query filter "IsDeleted = false" cho MỌI entity ISoftDeletable
        // (gồm cả bảng Users) — đảm bảo xóa mềm áp dụng nhất quán toàn hệ thống.
        foreach (var entityType in builder.Model.GetEntityTypes())
        {
            if (!typeof(ISoftDeletable).IsAssignableFrom(entityType.ClrType))
                continue;

            var parameter = Expression.Parameter(entityType.ClrType, "e");
            var filter = Expression.Lambda(
                Expression.Equal(
                    Expression.Property(parameter, nameof(ISoftDeletable.IsDeleted)),
                    Expression.Constant(false)),
                parameter);

            builder.Entity(entityType.ClrType).HasQueryFilter(filter);
        }
    }
}
