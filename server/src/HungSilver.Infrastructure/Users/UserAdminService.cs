using HungSilver.Application.Abstractions;
using HungSilver.Application.Common.Models;
using HungSilver.Application.Users;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Infrastructure.Identity;
using HungSilver.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Users;

public sealed class UserAdminService(
    UserManager<AppUser> userManager,
    AppDbContext context,
    ICurrentUser currentUser) : IUserAdminService
{
    private static readonly Error UserNotFound =
        Error.NotFound("Users.NotFound", "Không tìm thấy người dùng.");

    public async Task<Result<PagedResult<UserListItemDto>>> GetUsersAsync(PagedRequest request, CancellationToken ct = default)
    {
        // IgnoreQueryFilters: admin xem được cả user đã xóa mềm để khôi phục.
        var query = context.Users.IgnoreQueryFilters().AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLower();
            query = query.Where(u =>
                u.Email!.ToLower().Contains(term) ||
                (u.FullName != null && u.FullName.ToLower().Contains(term)));
        }

        var totalCount = await query.CountAsync(ct);

        var page = Math.Max(request.Page, 1);
        var users = await query
            .OrderByDescending(u => u.CreatedAtUtc)
            .Skip((page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(ct);

        var userIds = users.Select(u => u.Id).ToList();
        var roleMap = await (
                from userRole in context.UserRoles
                join role in context.Roles on userRole.RoleId equals role.Id
                where userIds.Contains(userRole.UserId)
                select new { userRole.UserId, role.Name })
            .GroupBy(x => x.UserId)
            .ToDictionaryAsync(g => g.Key, g => g.Select(x => x.Name!).ToList(), ct);

        var items = users.Select(u => new UserListItemDto(
            u.Id,
            u.UserName!,
            u.Email!,
            u.FullName,
            roleMap.TryGetValue(u.Id, out var roles) ? roles : [],
            u.IsDeleted,
            u.CreatedAtUtc)).ToList();

        return new PagedResult<UserListItemDto>
        {
            Items = items,
            Page = page,
            PageSize = request.PageSize,
            TotalCount = totalCount
        };
    }

    public async Task<Result<UserListItemDto>> CreateUserAsync(CreateUserRequest request, CancellationToken ct = default)
    {
        // Admin chỉ tạo Admin/Giáo viên; học sinh do giáo viên tạo trong lớp.
        var role = request.Role?.Trim();
        if (role != AppRoles.Admin && role != AppRoles.Teacher)
            return Result.Failure<UserListItemDto>(Error.Validation(
                "Users.InvalidRole", "Vai trò chỉ được là Quản trị viên hoặc Giáo viên."));

        var userName = request.UserName?.Trim();
        if (string.IsNullOrWhiteSpace(userName))
            return Result.Failure<UserListItemDto>(Error.Validation("Users.UserNameRequired", "Vui lòng nhập tên đăng nhập."));
        if (string.IsNullOrWhiteSpace(request.Password))
            return Result.Failure<UserListItemDto>(Error.Validation("Users.PasswordRequired", "Vui lòng nhập mật khẩu."));

        var email = string.IsNullOrWhiteSpace(request.Email)
            ? (userName.Contains('@') ? userName : $"{userName}@hedu.local")
            : request.Email.Trim();

        // Kiểm tra trùng username/email kể cả tài khoản đã xóa mềm (unique index của Identity giữ chỗ).
        if (await context.Users.IgnoreQueryFilters()
                .AnyAsync(u => u.NormalizedUserName == userManager.NormalizeName(userName), ct))
            return Result.Failure<UserListItemDto>(Error.Conflict("Users.UserNameTaken", "Tên đăng nhập đã tồn tại."));
        if (await context.Users.IgnoreQueryFilters()
                .AnyAsync(u => u.NormalizedEmail == userManager.NormalizeEmail(email), ct))
            return Result.Failure<UserListItemDto>(Error.Conflict("Users.EmailTaken", "Email đã được sử dụng."));

        var user = new AppUser
        {
            UserName = userName,
            Email = email,
            EmailConfirmed = true,
            FullName = string.IsNullOrWhiteSpace(request.FullName) ? null : request.FullName.Trim()
        };

        var created = await userManager.CreateAsync(user, request.Password);
        if (!created.Succeeded)
            return Result.Failure<UserListItemDto>(Error.Validation(
                "Users.CreateFailed", string.Join(" | ", created.Errors.Select(e => e.Description))));

        var addRole = await userManager.AddToRoleAsync(user, role);
        if (!addRole.Succeeded)
            return Result.Failure<UserListItemDto>(Error.Failure(
                "Users.AssignRoleFailed", string.Join(" | ", addRole.Errors.Select(e => e.Description))));

        return new UserListItemDto(user.Id, user.UserName!, user.Email!, user.FullName, [role], user.IsDeleted, user.CreatedAtUtc);
    }

    public async Task<Result> AssignRolesAsync(Guid userId, AssignRolesRequest request, CancellationToken ct = default)
    {
        var invalidRoles = request.Roles.Except(AppRoles.All).ToList();
        if (invalidRoles.Count > 0)
            return Result.Failure(Error.Validation(
                "Users.InvalidRole", $"Role không hợp lệ: {string.Join(", ", invalidRoles)}."));

        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return Result.Failure(UserNotFound);

        var currentRoles = await userManager.GetRolesAsync(user);

        if (currentRoles.Contains(AppRoles.Admin) && !request.Roles.Contains(AppRoles.Admin))
        {
            var guard = await EnsureNotLastAdminAsync(ct);
            if (guard.IsFailure) return guard;
        }

        var toRemove = currentRoles.Except(request.Roles).ToList();
        var toAdd = request.Roles.Except(currentRoles).ToList();

        if (toRemove.Count > 0)
        {
            var removed = await userManager.RemoveFromRolesAsync(user, toRemove);
            if (!removed.Succeeded)
                return Result.Failure(Error.Failure("Users.AssignRolesFailed",
                    string.Join(" | ", removed.Errors.Select(e => e.Description))));
        }

        if (toAdd.Count > 0)
        {
            var added = await userManager.AddToRolesAsync(user, toAdd);
            if (!added.Succeeded)
                return Result.Failure(Error.Failure("Users.AssignRolesFailed",
                    string.Join(" | ", added.Errors.Select(e => e.Description))));
        }

        return Result.Success();
    }

    public async Task<Result> SoftDeleteAsync(Guid userId, CancellationToken ct = default)
    {
        if (currentUser.UserId == userId)
            return Result.Failure(Error.Conflict("Users.CannotDeleteSelf", "Không thể tự xóa tài khoản của chính mình."));

        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return Result.Failure(UserNotFound);

        if (await userManager.IsInRoleAsync(user, AppRoles.Admin))
        {
            var guard = await EnsureNotLastAdminAsync(ct);
            if (guard.IsFailure) return guard;
        }

        // Remove → AuditSaveChangesInterceptor chuyển thành soft delete.
        context.Users.Remove(user);

        // Thu hồi mọi refresh token còn hiệu lực của user bị xóa.
        var activeTokens = await context.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAtUtc == null)
            .ToListAsync(ct);
        foreach (var token in activeTokens)
            token.RevokedAtUtc = DateTime.UtcNow;

        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result> RestoreAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await context.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId && u.IsDeleted, ct);

        if (user is null)
            return Result.Failure(UserNotFound);

        user.IsDeleted = false;
        user.DeletedAtUtc = null;

        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    private async Task<Result> EnsureNotLastAdminAsync(CancellationToken ct)
    {
        var adminCount = await (
                from userRole in context.UserRoles
                join role in context.Roles on userRole.RoleId equals role.Id
                join user in context.Users on userRole.UserId equals user.Id
                where role.Name == AppRoles.Admin
                select userRole.UserId)
            .CountAsync(ct);

        return adminCount <= 1
            ? Result.Failure(Error.Conflict("Users.LastAdmin", "Không thể gỡ bỏ admin cuối cùng của hệ thống."))
            : Result.Success();
    }
}
