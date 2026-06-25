using HungSilver.Application.Abstractions;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Services;

public sealed class UserDirectory(AppDbContext context) : IUserDirectory
{
    public Task<bool> ExistsAsync(Guid userId, CancellationToken ct = default) =>
        context.Users.AnyAsync(u => u.Id == userId, ct);

    public Task<bool> IsInRoleAsync(Guid userId, string role, CancellationToken ct = default) =>
        (from ur in context.UserRoles
         join r in context.Roles on ur.RoleId equals r.Id
         where ur.UserId == userId && r.Name == role
         select ur.UserId).AnyAsync(ct);

    public async Task<Dictionary<Guid, string>> GetDisplayNamesAsync(IEnumerable<Guid> userIds, CancellationToken ct = default)
    {
        var ids = userIds.Distinct().ToList();
        if (ids.Count == 0)
            return [];

        return await context.Users
            .Where(u => ids.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName ?? u.Email ?? u.Id.ToString(), ct);
    }

    public async Task<Dictionary<Guid, AccountInfo>> GetAccountInfosAsync(IEnumerable<Guid> userIds, CancellationToken ct = default)
    {
        var ids = userIds.Distinct().ToList();
        if (ids.Count == 0)
            return [];

        // IgnoreQueryFilters: vẫn lấy thông tin kể cả tài khoản đã xóa mềm (hiển thị trạng thái chính xác).
        var rows = await context.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .Select(u => new { u.Id, u.UserName, u.LockoutEnd, u.MustChangePassword })
            .ToListAsync(ct);

        var now = DateTimeOffset.Now;
        return rows.ToDictionary(
            u => u.Id,
            u => new AccountInfo(u.UserName ?? string.Empty, u.LockoutEnd.HasValue && u.LockoutEnd.Value > now, u.MustChangePassword));
    }

    public Task<List<UserSummary>> GetUsersInRoleAsync(string role, CancellationToken ct = default) =>
        (from u in context.Users
         join ur in context.UserRoles on u.Id equals ur.UserId
         join r in context.Roles on ur.RoleId equals r.Id
         where r.Name == role
         select new UserSummary(u.Id, u.Email!, u.FullName)).ToListAsync(ct);

    public async Task<IReadOnlyList<string>> GetRolesAsync(Guid userId, CancellationToken ct = default) =>
        await (from ur in context.UserRoles
               join r in context.Roles on ur.RoleId equals r.Id
               where ur.UserId == userId
               select r.Name!).ToListAsync(ct);

    public async Task<Guid?> GetRoleIdAsync(string role, CancellationToken ct = default)
    {
        var r = await context.Roles.FirstOrDefaultAsync(x => x.Name == role, ct);
        return r?.Id;
    }
}
