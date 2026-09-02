using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Application.Common.Models;
using HungSilver.Application.Settings;
using HungSilver.Application.Users;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Infrastructure.Identity;
using HungSilver.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Users;

public sealed class UserAdminService(
    UserManager<AppUser> userManager,
    AppDbContext context,
    ICurrentRelationCleanupService relationCleanup,
    ISettingsResolver settingsResolver,
    ICurrentUser currentUser) : IUserAdminService
{
    private static readonly Error UserNotFound =
        Error.NotFound("Users.NotFound", "Không tìm thấy người dùng.");

    public async Task<Result<PagedResult<UserListItemDto>>> GetUsersAsync(UserListRequest request, CancellationToken ct = default)
    {
        // IgnoreQueryFilters: admin xem được cả user đã xóa mềm để khôi phục.
        var query = context.Users.IgnoreQueryFilters().AsNoTracking();

        var requestedRole = request.Role?.Trim();
        if (!string.IsNullOrWhiteSpace(requestedRole))
        {
            var matchedRole = AppRoles.All.FirstOrDefault(r => string.Equals(r, requestedRole, StringComparison.OrdinalIgnoreCase));
            if (matchedRole is null)
                return Result.Failure<PagedResult<UserListItemDto>>(
                    Error.Validation("Users.InvalidRoleFilter", "Quyền lọc không hợp lệ."));

            var normalizedRole = userManager.NormalizeName(matchedRole);
            var roleId = await context.Roles
                .Where(r => r.NormalizedName == normalizedRole)
                .Select(r => r.Id)
                .FirstOrDefaultAsync(ct);

            query = roleId == Guid.Empty
                ? query.Where(_ => false)
                : query.Where(u => context.UserRoles.Any(ur => ur.UserId == u.Id && ur.RoleId == roleId));
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLower();
            query = query.Where(u =>
                u.UserName!.ToLower().Contains(term) ||
                u.Email!.ToLower().Contains(term) ||
                (u.FullName != null && u.FullName.ToLower().Contains(term)));
        }

        var totalCount = await query.CountAsync(ct);

        var page = Math.Max(request.Page, 1);
        var users = await query
            .OrderByDescending(u => u.CreatedAt)
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

        // Tài khoản liên kết hồ sơ HS/GV: tên đăng nhập = mã hồ sơ nên không cho đổi ở trang Người dùng.
        var studentUserIds = (await context.Students
            .Where(s => s.UserId != null && userIds.Contains(s.UserId.Value))
            .Select(s => s.UserId!.Value).ToListAsync(ct)).ToHashSet();
        var teacherUserIds = (await context.TeacherProfiles
            .Where(t => t.UserId != null && userIds.Contains(t.UserId.Value))
            .Select(t => t.UserId!.Value).ToListAsync(ct)).ToHashSet();

        var items = users.Select(u => ToListItem(
            u,
            roleMap.TryGetValue(u.Id, out var roles) ? roles : [],
            studentUserIds.Contains(u.Id) ? "Student" : teacherUserIds.Contains(u.Id) ? "Teacher" : null)).ToList();

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
        // Trang Người dùng chỉ tạo tài khoản QUẢN TRỊ. Tài khoản Giáo viên cấp ở trang Giáo viên
        // (tên đăng nhập = Mã GV), tài khoản Học sinh cấp ở trang Học viên — đều qua service cấp
        // tài khoản chung để đảm bảo nhất quán (username = mã, 1-1, bắt đổi mật khẩu lần đầu).
        var role = request.Role?.Trim();
        if (role != AppRoles.Admin)
            return Result.Failure<UserListItemDto>(Error.Validation(
                "Users.InvalidRole", "Trang Người dùng chỉ tạo tài khoản Quản trị viên. Tài khoản Giáo viên/Học sinh cấp ở trang tương ứng."));

        var userName = request.UserName?.Trim();
        if (string.IsNullOrWhiteSpace(userName))
            return Result.Failure<UserListItemDto>(Error.Validation("Users.UserNameRequired", "Vui lòng nhập tên đăng nhập."));
        // Mật khẩu bỏ trống ⇒ dùng mật khẩu mặc định của trung tâm (giống cấp tài khoản HS/GV).
        var password = await ResolveDefaultPasswordAsync(request.Password, ct);

        // Không sinh email ảo nữa: bỏ trống email ⇒ để null, đăng nhập bằng tên đăng nhập.
        var email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();

        // Kiểm tra trùng username/email kể cả tài khoản đã xóa mềm (unique index của Identity giữ chỗ).
        if (await context.Users.IgnoreQueryFilters()
                .AnyAsync(u => u.NormalizedUserName == userManager.NormalizeName(userName), ct))
            return Result.Failure<UserListItemDto>(Error.Conflict("Users.UserNameTaken", "Tên đăng nhập đã tồn tại."));
        if (email is not null && await context.Users.IgnoreQueryFilters()
                .AnyAsync(u => u.NormalizedEmail == userManager.NormalizeEmail(email), ct))
            return Result.Failure<UserListItemDto>(Error.Conflict("Users.EmailTaken", "Email đã được sử dụng."));

        var user = new AppUser
        {
            UserName = userName,
            Email = email,
            EmailConfirmed = true,
            FullName = string.IsNullOrWhiteSpace(request.FullName) ? null : request.FullName.Trim(),
            // Admin mới cũng bị buộc đổi mật khẩu ở lần đăng nhập đầu — thống nhất với HS/GV.
            MustChangePassword = await ForceChangePasswordAsync(ct)
        };

        var created = await userManager.CreateAsync(user, password);
        if (!created.Succeeded)
            return Result.Failure<UserListItemDto>(Error.Validation(
                "Users.CreateFailed", string.Join(" | ", created.Errors.Select(e => e.Description))));

        var addRole = await userManager.AddToRoleAsync(user, role);
        if (!addRole.Succeeded)
            return Result.Failure<UserListItemDto>(Error.Failure(
                "Users.AssignRoleFailed", string.Join(" | ", addRole.Errors.Select(e => e.Description))));

        return ToListItem(user, [role], null);
    }

    public async Task<Result<UserListItemDto>> UpdateUserAsync(Guid userId, UpdateUserRequest request, CancellationToken ct = default)
    {
        // FindByIdAsync đi qua query filter ⇒ user đã xóa mềm không sửa được (phải khôi phục trước).
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return Result.Failure<UserListItemDto>(UserNotFound);

        string? linkedType = null;
        if (await context.Students.AnyAsync(s => s.UserId == userId, ct)) linkedType = "Student";
        else if (await context.TeacherProfiles.AnyAsync(t => t.UserId == userId, ct)) linkedType = "Teacher";

        // Tên đăng nhập: bỏ trống ⇒ giữ nguyên. Tài khoản liên kết hồ sơ HS/GV không được đổi
        // (bất biến "tên đăng nhập = mã hồ sơ" — đổi mã ở trang Học viên/Giáo viên).
        var userName = request.UserName?.Trim();
        if (!string.IsNullOrWhiteSpace(userName) && userName != user.UserName)
        {
            if (linkedType is not null)
                return Result.Failure<UserListItemDto>(Error.Conflict("Users.UserNameLinked",
                    "Tài khoản này liên kết hồ sơ Học sinh/Giáo viên — tên đăng nhập phải bằng mã hồ sơ, không đổi được ở đây."));
            if (await context.Users.IgnoreQueryFilters().AnyAsync(
                    u => u.Id != userId && u.NormalizedUserName == userManager.NormalizeName(userName), ct))
                return Result.Failure<UserListItemDto>(Error.Conflict("Users.UserNameTaken", "Tên đăng nhập đã tồn tại."));
            user.UserName = userName;
        }

        // Email: bỏ trống ⇒ giữ nguyên (mọi tài khoản luôn có email — thật hoặc ảo theo mã).
        var email = request.Email?.Trim();
        if (!string.IsNullOrWhiteSpace(email) && !string.Equals(email, user.Email, StringComparison.OrdinalIgnoreCase))
        {
            if (!email.Contains('@'))
                return Result.Failure<UserListItemDto>(Error.Validation("Users.InvalidEmail", "Email không hợp lệ."));
            if (await context.Users.IgnoreQueryFilters().AnyAsync(
                    u => u.Id != userId && u.NormalizedEmail == userManager.NormalizeEmail(email), ct))
                return Result.Failure<UserListItemDto>(Error.Conflict("Users.EmailTaken", "Email đã được sử dụng."));
            user.Email = email;
            user.EmailConfirmed = true;
        }

        user.FullName = string.IsNullOrWhiteSpace(request.FullName) ? null : request.FullName.Trim();
        user.PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim();

        var updated = await userManager.UpdateAsync(user);
        if (!updated.Succeeded)
            return Result.Failure<UserListItemDto>(Error.Validation(
                "Users.UpdateFailed", string.Join(" | ", updated.Errors.Select(e => e.Description))));

        var roles = await userManager.GetRolesAsync(user);
        return ToListItem(user, roles.ToList(), linkedType);
    }

    public async Task<Result> ResetPasswordAsync(Guid userId, AdminResetPasswordRequest request, CancellationToken ct = default)
    {
        // Đổi mật khẩu của chính mình đi qua trang Hồ sơ (yêu cầu mật khẩu hiện tại) — tránh
        // admin tự reset rồi bị thu hồi phiên/bắt đổi mật khẩu gây khó hiểu.
        if (currentUser.UserId == userId)
            return Result.Failure(Error.Conflict("Users.CannotResetSelf",
                "Đổi mật khẩu của chính bạn tại trang Hồ sơ cá nhân."));

        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return Result.Failure(UserNotFound);

        var password = await ResolveDefaultPasswordAsync(request.Password, ct);

        // Validate mật khẩu TRƯỚC khi gỡ mật khẩu cũ — nếu gỡ xong mới fail thì tài khoản kẹt không còn mật khẩu.
        foreach (var validator in userManager.PasswordValidators)
        {
            var check = await validator.ValidateAsync(userManager, user, password);
            if (!check.Succeeded)
                return Result.Failure(Error.Validation(
                    "Users.ResetPasswordFailed", string.Join(" | ", check.Errors.Select(e => e.Description))));
        }

        var removed = await userManager.RemovePasswordAsync(user);
        if (!removed.Succeeded)
            return Result.Failure(Error.Failure(
                "Users.ResetPasswordFailed", string.Join(" | ", removed.Errors.Select(e => e.Description))));

        var added = await userManager.AddPasswordAsync(user, password);
        if (!added.Succeeded)
            return Result.Failure(Error.Validation(
                "Users.ResetPasswordFailed", string.Join(" | ", added.Errors.Select(e => e.Description))));

        // Luôn ép đổi ở lần đăng nhập kế tiếp (theo cấu hình trung tâm) — thống nhất với đường cấp
        // tài khoản HS/GV; admin không còn tùy chọn tắt để tránh 2 hành vi khác nhau cho cùng một việc.
        user.MustChangePassword = await ForceChangePasswordAsync(ct);
        await userManager.UpdateAsync(user);

        await RevokeRefreshTokensAsync(userId, ct);
        return Result.Success();
    }

    /// <summary>Mật khẩu yêu cầu, bỏ trống ⇒ mật khẩu mặc định của trung tâm.</summary>
    private async Task<string> ResolveDefaultPasswordAsync(string? requested, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(requested)) return requested;
        var configured = await settingsResolver.GetEffectiveValueAsync(SettingKeys.AccountDefaultPassword, ct: ct);
        return string.IsNullOrWhiteSpace(configured) ? SettingKeys.Defaults[SettingKeys.AccountDefaultPassword] : configured;
    }

    /// <summary>Có bắt đổi mật khẩu ở lần đăng nhập đầu không (cấu hình Admin, mặc định bật).</summary>
    private async Task<bool> ForceChangePasswordAsync(CancellationToken ct)
    {
        var configured = await settingsResolver.GetEffectiveValueAsync(SettingKeys.AccountForceChangePassword, ct: ct);
        return !bool.TryParse(configured?.Trim(), out var force) || force;
    }

    public async Task<Result> SetLockedAsync(Guid userId, bool locked, CancellationToken ct = default)
    {
        // Không cho tự khóa ⇒ luôn còn ít nhất 1 admin (người thao tác) đăng nhập được.
        if (locked && currentUser.UserId == userId)
            return Result.Failure(Error.Conflict("Users.CannotLockSelf", "Không thể tự khóa tài khoản của chính mình."));

        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return Result.Failure(UserNotFound);

        await userManager.SetLockoutEnabledAsync(user, true);
        var set = await userManager.SetLockoutEndDateAsync(user, locked ? DateTimeOffset.MaxValue : null);
        if (!set.Succeeded)
            return Result.Failure(Error.Failure(
                "Users.LockFailed", string.Join(" | ", set.Errors.Select(e => e.Description))));

        // Khóa ⇒ đăng xuất các phiên hiện hành.
        if (locked)
            await RevokeRefreshTokensAsync(userId, ct);
        return Result.Success();
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

        await relationCleanup.UnlinkUserRelationsAsync(userId, ct);

        // Remove → AuditSaveChangesInterceptor chuyển thành soft delete.
        context.Users.Remove(user);

        // Thu hồi mọi refresh token còn hiệu lực của user bị xóa.
        var activeTokens = await context.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ToListAsync(ct);
        foreach (var token in activeTokens)
            token.RevokedAt = DateTime.Now;

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
        user.DeletedAt = null;

        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    private async Task RevokeRefreshTokensAsync(Guid userId, CancellationToken ct)
    {
        var active = await context.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ToListAsync(ct);
        foreach (var token in active)
            token.RevokedAt = DateTime.Now;
        if (active.Count > 0)
            await context.SaveChangesAsync(ct);
    }

    private static UserListItemDto ToListItem(AppUser u, IReadOnlyList<string> roles, string? linkedType) => new(
        u.Id,
        u.UserName!,
        u.Email!,
        u.FullName,
        u.PhoneNumber,
        roles,
        u.IsDeleted,
        u.LockoutEnd != null && u.LockoutEnd > DateTimeOffset.Now,
        linkedType,
        u.CreatedAt);

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
