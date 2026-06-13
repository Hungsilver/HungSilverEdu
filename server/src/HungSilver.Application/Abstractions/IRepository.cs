using System.Linq.Expressions;
using HungSilver.Application.Common.Models;
using HungSilver.Domain.Common;

namespace HungSilver.Application.Abstractions;

/// <summary>
/// Lớp CRUD chung cho mọi entity kế thừa BaseEntity.
/// Mặc định mọi truy vấn đã loại bản ghi soft-deleted (global query filter);
/// đặt includeDeleted = true khi cần xem/khôi phục bản ghi đã xóa.
/// </summary>
public interface IRepository<T> where T : BaseEntity
{
    Task<T?> GetByIdAsync(Guid id, bool includeDeleted = false, CancellationToken ct = default);

    Task<List<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);

    Task<bool> AnyAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);

    Task<PagedResult<T>> GetPagedAsync(
        int page,
        int pageSize,
        Expression<Func<T, bool>>? filter = null,
        string? sortBy = null,
        bool sortDesc = false,
        bool includeDeleted = false,
        CancellationToken ct = default);

    Task AddAsync(T entity, CancellationToken ct = default);

    void Update(T entity);

    /// <summary>Đánh dấu xóa mềm (interceptor sẽ chuyển Remove thành IsDeleted = true).</summary>
    void SoftDelete(T entity);

    /// <summary>Khôi phục bản ghi đã xóa mềm. Trả về false nếu không tìm thấy.</summary>
    Task<bool> RestoreAsync(Guid id, CancellationToken ct = default);
}
