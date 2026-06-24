using System.Linq.Expressions;
using System.Reflection;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Common.Models;
using HungSilver.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Persistence.Repositories;

/// <summary>
/// Generic repository xử lý CRUD chung cho mọi entity BaseEntity.
/// Xóa qua repository luôn là xóa mềm (AuditSaveChangesInterceptor chuyển Remove → UPDATE IsDeleted).
/// </summary>
public class Repository<T>(AppDbContext context) : IRepository<T> where T : BaseEntity
{
    protected readonly AppDbContext Context = context;

    protected IQueryable<T> Query(bool includeDeleted = false) =>
        includeDeleted ? Context.Set<T>().IgnoreQueryFilters() : Context.Set<T>();

    public Task<T?> GetByIdAsync(Guid id, bool includeDeleted = false, CancellationToken ct = default) =>
        Query(includeDeleted).FirstOrDefaultAsync(e => e.Id == id, ct);

    // Mặc định trả mới nhất trước (CreatedAt desc) — đồng bộ với GetPagedAsync, tránh thứ tự DB ngẫu nhiên.
    // Caller cần thứ tự khác (vd danh mục theo IndexOrder) tự sắp lại sau khi nhận list.
    public Task<List<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default) =>
        Query().Where(predicate).OrderByDescending(e => e.CreatedAt).ToListAsync(ct);

    public Task<bool> AnyAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default, bool includeDeleted = false) =>
        Query(includeDeleted).AnyAsync(predicate, ct);

    public async Task<PagedResult<T>> GetPagedAsync(
        int page,
        int pageSize,
        Expression<Func<T, bool>>? filter = null,
        string? sortBy = null,
        bool sortDesc = false,
        bool includeDeleted = false,
        CancellationToken ct = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = Query(includeDeleted);
        if (filter is not null)
            query = query.Where(filter);

        var totalCount = await query.CountAsync(ct);

        var items = await ApplySort(query, sortBy, sortDesc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<T>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task AddAsync(T entity, CancellationToken ct = default) =>
        await Context.Set<T>().AddAsync(entity, ct);

    public void Update(T entity) => Context.Set<T>().Update(entity);

    public void SoftDelete(T entity) => Context.Set<T>().Remove(entity);

    public async Task<bool> RestoreAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await Context.Set<T>().IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.Id == id && e.IsDeleted, ct);

        if (entity is null)
            return false;

        entity.IsDeleted = false;
        entity.DeletedAt = null;
        return true;
    }

    private static IQueryable<T> ApplySort(IQueryable<T> query, string? sortBy, bool desc)
    {
        if (string.IsNullOrWhiteSpace(sortBy))
            return query.OrderByDescending(e => e.CreatedAt);

        var property = typeof(T).GetProperty(sortBy,
            BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);

        if (property is null)
            return query.OrderByDescending(e => e.CreatedAt);

        var parameter = Expression.Parameter(typeof(T), "e");
        var lambda = Expression.Lambda(Expression.Property(parameter, property), parameter);

        var call = Expression.Call(
            typeof(Queryable),
            desc ? nameof(Queryable.OrderByDescending) : nameof(Queryable.OrderBy),
            [typeof(T), property.PropertyType],
            query.Expression,
            Expression.Quote(lambda));

        return (IQueryable<T>)query.Provider.CreateQuery(call);
    }
}
