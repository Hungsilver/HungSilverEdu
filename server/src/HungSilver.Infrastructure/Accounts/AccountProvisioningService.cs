using HungSilver.Application.Accounts;
using HungSilver.Application.Common;
using HungSilver.Application.Settings;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Infrastructure.Identity;
using HungSilver.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Accounts;

/// <summary>
/// Hiện thực vòng đời tài khoản HS/GV. Mọi luồng tạo/đặt-lại/khóa/liên kết tài khoản đều đi qua đây
/// để đảm bảo nhất quán: username = mã, email ảo theo 1 quy tắc, mật khẩu mặc định + bắt đổi lần đầu,
/// 1-1 chặt. Xem <see cref="IAccountProvisioningService"/>.
/// </summary>
public sealed class AccountProvisioningService(
    AppDbContext context,
    UserManager<AppUser> userManager,
    IClassAccessGuard accessGuard,
    ISettingsResolver settingsResolver) : IAccountProvisioningService
{
    private static readonly Error StudentNotFound = Error.NotFound("Student.NotFound", "Không tìm thấy học sinh.");
    private static readonly Error TeacherNotFound = Error.NotFound("Teacher.NotFound", "Không tìm thấy giáo viên.");

    // ---------------------------------------------------------------- Học sinh

    public async Task<Result<AccountProvisionResultDto>> ProvisionStudentAsync(
        Guid studentId, ProvisionAccountOptions? options = null, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessStudentAsync(studentId, ct);
        if (access.IsFailure)
            return Result.Failure<AccountProvisionResultDto>(access.Error);

        var student = await context.Students.FirstOrDefaultAsync(s => s.Id == studentId, ct);
        if (student is null)
            return Result.Failure<AccountProvisionResultDto>(StudentNotFound);
        if (student.UserId is not null)
            return Result.Failure<AccountProvisionResultDto>(Error.Conflict("Student.AlreadyHasAccount", "Học sinh này đã có tài khoản đăng nhập."));

        var userResult = await CreateLinkedUserAsync(student.StudentCode, student.FullName, student.Email, AppRoles.User, options, ct);
        if (userResult.IsFailure)
            return Result.Failure<AccountProvisionResultDto>(userResult.Error);

        var (user, password) = userResult.Value;
        student.UserId = user.Id;
        await context.SaveChangesAsync(ct);

        return new AccountProvisionResultDto(user.Id, user.UserName!, password, user.MustChangePassword);
    }

    public async Task<BulkProvisionResultDto> ProvisionStudentsAsync(
        IReadOnlyCollection<Guid> studentIds, ProvisionAccountOptions? options = null, CancellationToken ct = default)
    {
        var items = new List<BulkProvisionItemDto>(studentIds.Count);
        foreach (var id in studentIds.Distinct())
        {
            var profile = await context.Students.AsNoTracking()
                .Where(s => s.Id == id).Select(s => new { s.StudentCode, s.FullName }).FirstOrDefaultAsync(ct);
            var r = await ProvisionStudentAsync(id, options, ct);
            items.Add(r.IsSuccess
                ? new BulkProvisionItemDto(id, true, profile?.StudentCode, profile?.FullName, r.Value.UserName, r.Value.Password, null)
                : new BulkProvisionItemDto(id, false, profile?.StudentCode, profile?.FullName, null, null, r.Error.Message));
        }
        return Summarize(items);
    }

    public async Task<Result> ResetStudentPasswordAsync(Guid studentId, string? newPassword = null, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessStudentAsync(studentId, ct);
        if (access.IsFailure)
            return access;

        var student = await context.Students.FirstOrDefaultAsync(s => s.Id == studentId, ct);
        if (student is null)
            return Result.Failure(StudentNotFound);

        return await ResetPasswordCoreAsync(student.UserId, newPassword, ct);
    }

    public async Task<Result> SetStudentLockedAsync(Guid studentId, bool locked, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessStudentAsync(studentId, ct);
        if (access.IsFailure)
            return access;

        var student = await context.Students.FirstOrDefaultAsync(s => s.Id == studentId, ct);
        if (student is null)
            return Result.Failure(StudentNotFound);

        return await SetLockedCoreAsync(student.UserId, locked, ct);
    }

    public async Task<Result> UnlinkStudentAsync(Guid studentId, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessStudentAsync(studentId, ct);
        if (access.IsFailure)
            return access;

        var student = await context.Students.FirstOrDefaultAsync(s => s.Id == studentId, ct);
        if (student is null)
            return Result.Failure(StudentNotFound);

        student.UserId = null;
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result> LinkStudentAsync(Guid studentId, Guid userId, CancellationToken ct = default)
    {
        var student = await context.Students.FirstOrDefaultAsync(s => s.Id == studentId, ct);
        if (student is null)
            return Result.Failure(StudentNotFound);
        if (student.UserId is not null)
            return Result.Failure(Error.Conflict("Student.AlreadyHasAccount", "Học sinh này đã có tài khoản đăng nhập."));

        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return Result.Failure(Error.NotFound("Users.NotFound", "Không tìm thấy tài khoản người dùng."));
        if (!await userManager.IsInRoleAsync(user, AppRoles.User))
            return Result.Failure(Error.Validation("Student.UserNotStudent", "Tài khoản liên kết phải có vai trò Học sinh."));

        if (await context.Students.IgnoreQueryFilters().AnyAsync(s => s.UserId == userId && s.Id != studentId, ct))
            return Result.Failure(Error.Conflict("Student.UserAlreadyLinked", "Tài khoản này đã liên kết với học sinh khác."));

        student.UserId = userId;
        try
        {
            await context.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Lưới an toàn cho đua check-then-set: unique index lọc trên UserId chặn liên kết trùng.
            return Result.Failure(Error.Conflict("Student.UserAlreadyLinked", "Tài khoản này đã liên kết với học sinh khác."));
        }
        return Result.Success();
    }

    // ---------------------------------------------------------------- Giáo viên

    public async Task<Result<AccountProvisionResultDto>> ProvisionTeacherAsync(
        Guid teacherProfileId, ProvisionAccountOptions? options = null, CancellationToken ct = default)
    {
        var teacher = await context.TeacherProfiles.FirstOrDefaultAsync(t => t.Id == teacherProfileId, ct);
        if (teacher is null)
            return Result.Failure<AccountProvisionResultDto>(TeacherNotFound);
        if (teacher.UserId is not null)
            return Result.Failure<AccountProvisionResultDto>(Error.Conflict("Teacher.AlreadyLinked", "Giáo viên này đã có tài khoản."));

        var userResult = await CreateLinkedUserAsync(teacher.TeacherCode, teacher.FullName, teacher.Email, AppRoles.Teacher, options, ct);
        if (userResult.IsFailure)
            return Result.Failure<AccountProvisionResultDto>(userResult.Error);

        var (user, password) = userResult.Value;
        teacher.UserId = user.Id;
        // Hồ sơ chưa có email mà tài khoản được cấp email thật (do người dùng nhập) ⇒ chép ngược về hồ sơ.
        if (string.IsNullOrWhiteSpace(teacher.Email) && !string.IsNullOrWhiteSpace(user.Email))
            teacher.Email = user.Email;
        await context.SaveChangesAsync(ct);

        return new AccountProvisionResultDto(user.Id, user.UserName!, password, user.MustChangePassword);
    }

    public async Task<BulkProvisionResultDto> ProvisionTeachersAsync(
        IReadOnlyCollection<Guid> teacherProfileIds, ProvisionAccountOptions? options = null, CancellationToken ct = default)
    {
        var items = new List<BulkProvisionItemDto>(teacherProfileIds.Count);
        foreach (var id in teacherProfileIds.Distinct())
        {
            var profile = await context.TeacherProfiles.AsNoTracking()
                .Where(t => t.Id == id).Select(t => new { t.TeacherCode, t.FullName }).FirstOrDefaultAsync(ct);
            var r = await ProvisionTeacherAsync(id, options, ct);
            items.Add(r.IsSuccess
                ? new BulkProvisionItemDto(id, true, profile?.TeacherCode, profile?.FullName, r.Value.UserName, r.Value.Password, null)
                : new BulkProvisionItemDto(id, false, profile?.TeacherCode, profile?.FullName, null, null, r.Error.Message));
        }
        return Summarize(items);
    }

    public async Task<Result> UnlinkTeacherAsync(Guid teacherProfileId, CancellationToken ct = default)
    {
        var teacher = await context.TeacherProfiles.FirstOrDefaultAsync(t => t.Id == teacherProfileId, ct);
        if (teacher is null)
            return Result.Failure(TeacherNotFound);

        teacher.UserId = null; // KHÔNG xóa AppUser — tài khoản còn đó, chỉ rời hồ sơ
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result> LinkTeacherAsync(Guid teacherProfileId, Guid userId, CancellationToken ct = default)
    {
        var teacher = await context.TeacherProfiles.FirstOrDefaultAsync(t => t.Id == teacherProfileId, ct);
        if (teacher is null)
            return Result.Failure(TeacherNotFound);
        if (teacher.UserId is not null)
            return Result.Failure(Error.Conflict("Teacher.AlreadyLinked", "Giáo viên này đã có tài khoản."));

        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return Result.Failure(Error.NotFound("Users.NotFound", "Không tìm thấy tài khoản người dùng."));
        if (!await userManager.IsInRoleAsync(user, AppRoles.Teacher))
            return Result.Failure(Error.Validation("Teacher.UserNotTeacher", "Tài khoản liên kết phải có vai trò Giáo viên."));

        if (await context.TeacherProfiles.IgnoreQueryFilters().AnyAsync(t => t.UserId == userId && t.Id != teacherProfileId, ct))
            return Result.Failure(Error.Conflict("Teacher.UserAlreadyLinked", "Tài khoản này đã liên kết với giáo viên khác."));

        teacher.UserId = userId;
        try
        {
            await context.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Lưới an toàn cho đua check-then-set: partial unique index trên TeacherProfile.UserId chặn trùng.
            return Result.Failure(Error.Conflict("Teacher.UserAlreadyLinked", "Tài khoản này đã liên kết với giáo viên khác."));
        }
        return Result.Success();
    }

    public async Task<Result> ResetTeacherPasswordAsync(Guid teacherProfileId, string? newPassword = null, CancellationToken ct = default)
    {
        var teacher = await context.TeacherProfiles.FirstOrDefaultAsync(t => t.Id == teacherProfileId, ct);
        if (teacher is null)
            return Result.Failure(TeacherNotFound);

        return await ResetPasswordCoreAsync(teacher.UserId, newPassword, ct);
    }

    public async Task<Result> SetTeacherLockedAsync(Guid teacherProfileId, bool locked, CancellationToken ct = default)
    {
        var teacher = await context.TeacherProfiles.FirstOrDefaultAsync(t => t.Id == teacherProfileId, ct);
        if (teacher is null)
            return Result.Failure(TeacherNotFound);

        return await SetLockedCoreAsync(teacher.UserId, locked, ct);
    }

    // ---------------------------------------------------------------- Lõi dùng chung

    /// <summary>Tạo AppUser mới gắn role + username=code + email theo quy tắc + mật khẩu mặc định/nhập.</summary>
    private async Task<Result<(AppUser User, string Password)>> CreateLinkedUserAsync(
        string code, string? fullName, string? profileEmail, string role, ProvisionAccountOptions? options, CancellationToken ct)
    {
        var userName = code.Trim();
        if (string.IsNullOrWhiteSpace(userName))
            return Result.Failure<(AppUser, string)>(Error.Validation("Account.NoCode", "Chưa có mã định danh để làm tên đăng nhập."));

        if (await context.Users.IgnoreQueryFilters().AnyAsync(u => u.NormalizedUserName == userManager.NormalizeName(userName), ct))
            return Result.Failure<(AppUser, string)>(Error.Conflict("Account.UserNameTaken", $"Tên đăng nhập '{userName}' đã tồn tại."));

        var email = await ResolveLoginEmailAsync(profileEmail, options?.LoginEmail, ct);
        var password = await ResolvePasswordAsync(options?.Password, ct);

        var user = new AppUser
        {
            UserName = userName,
            Email = email,
            EmailConfirmed = true,
            FullName = fullName,
            MustChangePassword = options?.MustChangePassword ?? await ForceChangePasswordAsync(ct)
        };

        var created = await userManager.CreateAsync(user, password);
        if (!created.Succeeded)
            return Result.Failure<(AppUser, string)>(Error.Validation("Account.CreateFailed", string.Join(" | ", created.Errors.Select(e => e.Description))));

        var addRole = await userManager.AddToRoleAsync(user, role);
        if (!addRole.Succeeded)
            return Result.Failure<(AppUser, string)>(Error.Failure("Account.AssignRoleFailed", string.Join(" | ", addRole.Errors.Select(e => e.Description))));

        return (user, password);
    }

    private async Task<Result> ResetPasswordCoreAsync(Guid? userId, string? newPassword, CancellationToken ct)
    {
        if (userId is null)
            return Result.Failure(Error.Validation("Account.NoAccount", "Đối tượng này chưa có tài khoản đăng nhập."));

        var user = await userManager.FindByIdAsync(userId.Value.ToString());
        if (user is null)
            return Result.Failure(Error.Validation("Account.NoAccount", "Không tìm thấy tài khoản."));

        var password = await ResolvePasswordAsync(newPassword, ct);

        // Validate mật khẩu TRƯỚC khi gỡ mật khẩu cũ — nếu gỡ xong mới fail thì tài khoản kẹt không còn mật khẩu.
        foreach (var validator in userManager.PasswordValidators)
        {
            var check = await validator.ValidateAsync(userManager, user, password);
            if (!check.Succeeded)
                return Result.Failure(Error.Validation(
                    "Account.ResetPasswordFailed", string.Join(" | ", check.Errors.Select(e => e.Description))));
        }

        var removed = await userManager.RemovePasswordAsync(user);
        if (!removed.Succeeded)
            return Result.Failure(Error.Failure("Account.ResetPasswordFailed", string.Join(" | ", removed.Errors.Select(e => e.Description))));

        var added = await userManager.AddPasswordAsync(user, password);
        if (!added.Succeeded)
            return Result.Failure(Error.Validation("Account.ResetPasswordFailed", string.Join(" | ", added.Errors.Select(e => e.Description))));

        user.MustChangePassword = await ForceChangePasswordAsync(ct);
        await userManager.UpdateAsync(user);

        await RevokeRefreshTokensAsync(user.Id, ct);
        return Result.Success();
    }

    private async Task<Result> SetLockedCoreAsync(Guid? userId, bool locked, CancellationToken ct)
    {
        if (userId is null)
            return Result.Failure(Error.Validation("Account.NoAccount", "Đối tượng này chưa có tài khoản đăng nhập."));

        var user = await userManager.FindByIdAsync(userId.Value.ToString());
        if (user is null)
            return Result.Failure(Error.Validation("Account.NoAccount", "Không tìm thấy tài khoản."));

        await userManager.SetLockoutEnabledAsync(user, true);
        var set = await userManager.SetLockoutEndDateAsync(user, locked ? DateTimeOffset.MaxValue : null);
        if (!set.Succeeded)
            return Result.Failure(Error.Failure("Account.LockFailed", string.Join(" | ", set.Errors.Select(e => e.Description))));

        // Khóa ⇒ đăng xuất các phiên hiện hành (thu hồi refresh token).
        if (locked)
            await RevokeRefreshTokensAsync(user.Id, ct);
        return Result.Success();
    }

    private async Task RevokeRefreshTokensAsync(Guid userId, CancellationToken ct)
    {
        var active = await context.RefreshTokens.Where(t => t.UserId == userId && t.RevokedAt == null).ToListAsync(ct);
        foreach (var token in active)
            token.RevokedAt = DateTime.Now;
        if (active.Count > 0)
            await context.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Email đăng nhập: ưu tiên LoginEmail tùy chọn → email thật trên hồ sơ. KHÔNG có email thật ⇒ trả null.
    /// Bỏ hẳn cơ chế "email ảo" (Identity đã tắt RequireUniqueEmail) — người dùng đăng nhập bằng MÃ (username).
    /// </summary>
    private async Task<string?> ResolveLoginEmailAsync(string? profileEmail, string? optionEmail, CancellationToken ct)
    {
        foreach (var candidate in new[] { Clean(optionEmail), Clean(profileEmail) })
        {
            if (candidate is not null && candidate.Contains('@') && !await EmailTakenAsync(candidate, ct))
                return candidate;
        }
        return null;
    }

    private async Task<bool> EmailTakenAsync(string email, CancellationToken ct) =>
        await context.Users.IgnoreQueryFilters().AnyAsync(u => u.NormalizedEmail == userManager.NormalizeEmail(email), ct);

    private async Task<string> ResolvePasswordAsync(string? requested, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(requested))
            return requested;
        var configured = await settingsResolver.GetEffectiveValueAsync(SettingKeys.AccountDefaultPassword, ct: ct);
        return string.IsNullOrWhiteSpace(configured) ? SettingKeys.Defaults[SettingKeys.AccountDefaultPassword] : configured;
    }

    /// <summary>Có bắt đổi mật khẩu ở lần đăng nhập đầu không (cấu hình Admin, mặc định bật).</summary>
    private async Task<bool> ForceChangePasswordAsync(CancellationToken ct)
    {
        var configured = await settingsResolver.GetEffectiveValueAsync(SettingKeys.AccountForceChangePassword, ct: ct);
        return !bool.TryParse(configured?.Trim(), out var force) || force;
    }


    private static BulkProvisionResultDto Summarize(List<BulkProvisionItemDto> items)
    {
        var ok = items.Count(i => i.Success);
        return new BulkProvisionResultDto(items.Count, ok, items.Count - ok, items);
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
