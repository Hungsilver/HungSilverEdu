using FluentValidation;
using HungSilver.Application.Common;
using HungSilver.Application.Common.Models;
using HungSilver.Application.Settings;
using HungSilver.Application.Teachers;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Infrastructure.Identity;
using HungSilver.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Teachers;

public sealed class TeacherService(
    AppDbContext context,
    UserManager<AppUser> userManager,
    ISettingsResolver settingsResolver,
    IValidator<CreateTeacherRequest> createValidator,
    IValidator<UpdateTeacherRequest> updateValidator,
    IValidator<CreateTeacherAccountRequest> createAccountValidator) : ITeacherService
{
    private static readonly Error NotFoundError = Error.NotFound("Teacher.NotFound", "Không tìm thấy giáo viên.");

    public async Task<Result<PagedResult<TeacherProfileDto>>> GetPagedAsync(PagedRequest request, bool includeDeleted = false, CancellationToken ct = default)
    {
        var query = includeDeleted
            ? context.TeacherProfiles.IgnoreQueryFilters().AsNoTracking()
            : context.TeacherProfiles.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLower();
            query = query.Where(t =>
                t.TeacherCode.ToLower().Contains(term)
                || t.FullName.ToLower().Contains(term)
                || (t.Phone != null && t.Phone.Contains(term))
                || (t.Email != null && t.Email.ToLower().Contains(term)));
        }

        var total = await query.CountAsync(ct);
        var page = Math.Max(request.Page, 1);
        var items = await query
            .OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(ct);

        var dto = await ToDtosAsync(items, ct);
        return new PagedResult<TeacherProfileDto>
        {
            Items = dto,
            Page = page,
            PageSize = request.PageSize,
            TotalCount = total
        };
    }

    public async Task<Result<TeacherDetailDto>> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var teacher = await context.TeacherProfiles.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, ct);
        if (teacher is null)
            return Result.Failure<TeacherDetailDto>(NotFoundError);

        var dto = (await ToDtosAsync([teacher], ct))[0];
        var classes = await context.Classes.AsNoTracking()
            .Where(c => c.TeacherProfileId == id)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new Application.Classes.ClassListItemDto(
                c.Id, c.ClassCode, c.Name, c.TeacherProfileId, c.TeacherName,
                c.BranchId, c.BranchCode, c.BranchName,
                c.SubjectId, c.SubjectName,
                c.GradeId, c.GradeName,
                c.TuitionFee, c.MaxCapacity, 0, c.IsActive, c.IsDeleted, c.CreatedAt))
            .ToListAsync(ct);

        return new TeacherDetailDto(dto, classes);
    }

    public async Task<Result<TeacherProfileDto>> CreateAsync(CreateTeacherRequest request, CancellationToken ct = default)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<TeacherProfileDto>(validation.ToError("Teacher.Validation"));

        var codeResult = await NextTeacherCodeAsync(request.TeacherCode, request.FullName, request.BranchId, ct);
        if (codeResult.IsFailure)
            return Result.Failure<TeacherProfileDto>(codeResult.Error);

        var userCheck = await ValidateUserLinkAsync(request.UserId, null, ct);
        if (userCheck.IsFailure)
            return Result.Failure<TeacherProfileDto>(userCheck.Error);

        var teacher = new TeacherProfile
        {
            TeacherCode = codeResult.Value,
            FullName = request.FullName.Trim(),
            Phone = Clean(request.Phone),
            Email = Clean(request.Email),
            DateOfBirth = request.DateOfBirth,
            Address = Clean(request.Address),
            Note = Clean(request.Note),
            UserId = Normalize(request.UserId),
            BranchId = Normalize(request.BranchId),
            IsActive = request.IsActive
        };

        context.TeacherProfiles.Add(teacher);
        await context.SaveChangesAsync(ct);
        return (await ToDtosAsync([teacher], ct))[0];
    }

    public async Task<Result<TeacherProfileDto>> UpdateAsync(Guid id, UpdateTeacherRequest request, CancellationToken ct = default)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<TeacherProfileDto>(validation.ToError("Teacher.Validation"));

        var teacher = await context.TeacherProfiles.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (teacher is null)
            return Result.Failure<TeacherProfileDto>(NotFoundError);

        // Giữ nguyên hoa/thường (mã sinh tự động có thể là "DongTho@TrangNTT0"); trùng không phân biệt hoa/thường.
        var code = request.TeacherCode.Trim();
        var codeLower = code.ToLower();
        if (!string.Equals(teacher.TeacherCode, code, StringComparison.OrdinalIgnoreCase)
            && await context.TeacherProfiles.IgnoreQueryFilters().AnyAsync(t => t.TeacherCode.ToLower() == codeLower, ct))
            return Result.Failure<TeacherProfileDto>(Error.Conflict("Teacher.DuplicateCode", $"Mã giáo viên '{request.TeacherCode}' đã tồn tại."));

        var userCheck = await ValidateUserLinkAsync(request.UserId, id, ct);
        if (userCheck.IsFailure)
            return Result.Failure<TeacherProfileDto>(userCheck.Error);

        teacher.TeacherCode = code;
        teacher.FullName = request.FullName.Trim();
        teacher.Phone = Clean(request.Phone);
        teacher.Email = Clean(request.Email);
        teacher.DateOfBirth = request.DateOfBirth;
        teacher.Address = Clean(request.Address);
        teacher.Note = Clean(request.Note);
        teacher.UserId = Normalize(request.UserId);
        teacher.BranchId = Normalize(request.BranchId);
        teacher.IsActive = request.IsActive;

        await context.SaveChangesAsync(ct);
        await SnapshotTeacherNameAsync(teacher, ct);
        return (await ToDtosAsync([teacher], ct))[0];
    }

    public async Task<Result<TeacherProfileDto>> CreateAccountAsync(CreateTeacherAccountRequest request, CancellationToken ct = default)
    {
        var validation = await createAccountValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<TeacherProfileDto>(validation.ToError("TeacherAccount.Validation"));

        TeacherProfile teacher;
        if (request.TeacherProfileId is not null)
        {
            var found = await context.TeacherProfiles.FirstOrDefaultAsync(t => t.Id == request.TeacherProfileId.Value, ct);
            if (found is null)
                return Result.Failure<TeacherProfileDto>(NotFoundError);
            teacher = found;
            if (teacher.UserId is not null)
                return Result.Failure<TeacherProfileDto>(Error.Conflict("Teacher.AlreadyLinked", "Giáo viên này đã có tài khoản."));
        }
        else
        {
            var codeResult = await NextTeacherCodeAsync(request.TeacherCode, request.FullName, request.BranchId, ct);
            if (codeResult.IsFailure)
                return Result.Failure<TeacherProfileDto>(codeResult.Error);

            teacher = new TeacherProfile
            {
                TeacherCode = codeResult.Value,
                FullName = request.FullName.Trim(),
                Phone = Clean(request.Phone),
                Email = Clean(request.Email),
                DateOfBirth = request.DateOfBirth,
                Address = Clean(request.Address),
                Note = Clean(request.Note),
                BranchId = Normalize(request.BranchId),
                IsActive = true
            };
            context.TeacherProfiles.Add(teacher);
        }

        var userName = request.UserName.Trim();
        var email = string.IsNullOrWhiteSpace(request.LoginEmail)
            ? (userName.Contains('@') ? userName : $"{userName}@hedu.local")
            : request.LoginEmail.Trim();

        if (await context.Users.IgnoreQueryFilters().AnyAsync(u => u.NormalizedUserName == userManager.NormalizeName(userName), ct))
            return Result.Failure<TeacherProfileDto>(Error.Conflict("Users.UserNameTaken", "Tên đăng nhập đã tồn tại."));
        if (await context.Users.IgnoreQueryFilters().AnyAsync(u => u.NormalizedEmail == userManager.NormalizeEmail(email), ct))
            return Result.Failure<TeacherProfileDto>(Error.Conflict("Users.EmailTaken", "Email đăng nhập đã được sử dụng."));

        var user = new AppUser
        {
            UserName = userName,
            Email = email,
            EmailConfirmed = true,
            FullName = teacher.FullName,
            PhoneNumber = teacher.Phone
        };

        var created = await userManager.CreateAsync(user, request.Password);
        if (!created.Succeeded)
            return Result.Failure<TeacherProfileDto>(Error.Validation("Users.CreateFailed", string.Join(" | ", created.Errors.Select(e => e.Description))));

        var role = await userManager.AddToRoleAsync(user, AppRoles.Teacher);
        if (!role.Succeeded)
            return Result.Failure<TeacherProfileDto>(Error.Failure("Users.AssignRoleFailed", string.Join(" | ", role.Errors.Select(e => e.Description))));

        teacher.UserId = user.Id;
        if (string.IsNullOrWhiteSpace(teacher.Email))
            teacher.Email = email;

        await context.SaveChangesAsync(ct);
        return (await ToDtosAsync([teacher], ct))[0];
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var teacher = await context.TeacherProfiles.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (teacher is null)
            return Result.Failure(NotFoundError);

        if (await context.Classes.AnyAsync(c => c.TeacherProfileId == id, ct))
            return Result.Failure(Error.Conflict("Teacher.HasClasses", "Không thể xóa giáo viên khi vẫn còn lớp đang quản lý."));

        teacher.IsDeleted = true;
        teacher.DeletedAt = DateTime.Now;
        context.TeacherProfiles.Update(teacher);
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result<TeacherProfileDto>> LinkAccountAsync(Guid teacherId, LinkAccountRequest request, CancellationToken ct = default)
    {
        var teacher = await context.TeacherProfiles.FirstOrDefaultAsync(t => t.Id == teacherId, ct);
        if (teacher is null)
            return Result.Failure<TeacherProfileDto>(NotFoundError);

        if (teacher.UserId is not null)
            return Result.Failure<TeacherProfileDto>(Error.Conflict("Teacher.AlreadyLinked", "Giáo viên này đã có tài khoản."));

        var userCheck = await ValidateUserLinkAsync(request.UserId, teacherId, ct);
        if (userCheck.IsFailure)
            return Result.Failure<TeacherProfileDto>(userCheck.Error);

        teacher.UserId = request.UserId;
        await context.SaveChangesAsync(ct);
        return (await ToDtosAsync([teacher], ct))[0];
    }

    public async Task<Result<TeacherProfileDto>> UnlinkAccountAsync(Guid teacherId, CancellationToken ct = default)
    {
        var teacher = await context.TeacherProfiles.FirstOrDefaultAsync(t => t.Id == teacherId, ct);
        if (teacher is null)
            return Result.Failure<TeacherProfileDto>(NotFoundError);

        teacher.UserId = null;
        await context.SaveChangesAsync(ct);
        return (await ToDtosAsync([teacher], ct))[0];
    }

    public async Task<Result<List<UnlinkedUserDto>>> GetUnlinkedUsersAsync(CancellationToken ct = default)
    {
        var linkedUserIds = await context.TeacherProfiles.IgnoreQueryFilters()
            .Where(t => t.UserId != null)
            .Select(t => t.UserId!.Value)
            .ToListAsync(ct);

        var teacherRoleUsers = await context.UserRoles.AsNoTracking()
            .Join(context.Roles.AsNoTracking(), ur => ur.RoleId, r => r.Id, (ur, r) => new { ur.UserId, r.Name })
            .Where(x => x.Name == AppRoles.Teacher)
            .Select(x => x.UserId)
            .ToListAsync(ct);

        var users = await context.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(u => teacherRoleUsers.Contains(u.Id) && !linkedUserIds.Contains(u.Id))
            .OrderBy(u => u.UserName)
            .Select(u => new UnlinkedUserDto(u.Id, u.UserName!, u.FullName))
            .ToListAsync(ct);

        return users;
    }

    private async Task<Result> ValidateUserLinkAsync(Guid? userId, Guid? teacherId, CancellationToken ct)
    {
        userId = Normalize(userId);
        if (userId is null)
            return Result.Success();

        var user = await userManager.FindByIdAsync(userId.Value.ToString());
        if (user is null)
            return Result.Failure(Error.NotFound("Users.NotFound", "Không tìm thấy tài khoản."));

        if (!await userManager.IsInRoleAsync(user, AppRoles.Teacher))
            return Result.Failure(Error.Validation("Teacher.UserNotTeacher", "Tài khoản liên kết phải có vai trò Giáo viên."));

        var used = await context.TeacherProfiles.IgnoreQueryFilters()
            .AnyAsync(t => t.UserId == userId && (teacherId == null || t.Id != teacherId.Value), ct);
        return used
            ? Result.Failure(Error.Conflict("Teacher.UserAlreadyLinked", "Tài khoản này đã được liên kết với giáo viên khác."))
            : Result.Success();
    }

    private async Task<Result<string>> NextTeacherCodeAsync(string? requested, string fullName, Guid? branchId, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(requested))
        {
            // Giữ nguyên hoa/thường người dùng nhập (prefix có thể chứa chữ thường, vd "DongTho@");
            // kiểm trùng không phân biệt hoa/thường.
            var manual = requested.Trim();
            var manualLower = manual.ToLower();
            return await context.TeacherProfiles.IgnoreQueryFilters().AnyAsync(t => t.TeacherCode.ToLower() == manualLower, ct)
                ? Result.Failure<string>(Error.Conflict("Teacher.DuplicateCode", $"Mã giáo viên '{manual}' đã tồn tại."))
                : (Result<string>)manual;
        }
        // Tự sinh theo rule: {prefix}{Ten}{VietTat}{counter} — prefix theo cơ sở (tự mang dấu phân tách).
        var prefix = await ResolveCodePrefixAsync(branchId, ct);
        for (var i = 0; i <= 99; i++)
        {
            var generated = NameCodeGenerator.GenerateTeacherCode(fullName, prefix, i);
            if (!await context.TeacherProfiles.IgnoreQueryFilters().AnyAsync(t => t.TeacherCode == generated, ct))
                return generated;
        }
        return UniqueCodeGenerator.Next(prefix);
    }

    /// <summary>
    /// Tiền tố sinh mã GV: lấy theo cơ sở (TeacherCodePrefix; trống → tên cơ sở PascalCase + "@").
    /// Không gắn cơ sở → fallback prefix toàn hệ thống (Center.CodePrefix).
    /// </summary>
    private async Task<string> ResolveCodePrefixAsync(Guid? branchId, CancellationToken ct)
    {
        if (Normalize(branchId) is { } id)
        {
            var branch = await context.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == id, ct);
            if (branch is not null)
                return string.IsNullOrWhiteSpace(branch.TeacherCodePrefix)
                    ? NameCodeGenerator.PascalCompact(branch.Name) + "@"
                    : branch.TeacherCodePrefix.Trim();
        }
        return await settingsResolver.GetEffectiveValueAsync(SettingKeys.CenterCodePrefix, ct: ct) ?? "HV";
    }

    private async Task SnapshotTeacherNameAsync(TeacherProfile teacher, CancellationToken ct)
    {
        var classes = await context.Classes.Where(c => c.TeacherProfileId == teacher.Id).ToListAsync(ct);
        foreach (var cls in classes)
            cls.TeacherName = teacher.FullName;
        if (classes.Count > 0)
            await context.SaveChangesAsync(ct);
    }

    private async Task<List<TeacherProfileDto>> ToDtosAsync(List<TeacherProfile> items, CancellationToken ct)
    {
        var ids = items.Select(t => t.Id).ToList();
        var counts = await context.Classes.AsNoTracking()
            .Where(c => c.TeacherProfileId != null && ids.Contains(c.TeacherProfileId.Value))
            .GroupBy(c => c.TeacherProfileId!.Value)
            .ToDictionaryAsync(g => g.Key, g => g.Count(), ct);

        var userIds = items.Where(t => t.UserId.HasValue).Select(t => t.UserId!.Value).Distinct().ToList();
        var userNames = await context.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.UserName, ct);

        var branchIds = items.Where(t => t.BranchId.HasValue).Select(t => t.BranchId!.Value).Distinct().ToList();
        var branchNames = await context.Branches.IgnoreQueryFilters().AsNoTracking()
            .Where(b => branchIds.Contains(b.Id))
            .ToDictionaryAsync(b => b.Id, b => b.Name, ct);

        return items.Select(t => new TeacherProfileDto(
            t.Id, t.TeacherCode, t.FullName, t.Phone, t.Email, t.DateOfBirth, t.Address, t.Note,
            t.UserId, t.UserId.HasValue ? userNames.GetValueOrDefault(t.UserId.Value) : null,
            t.BranchId, t.BranchId.HasValue ? branchNames.GetValueOrDefault(t.BranchId.Value) : null,
            t.IsActive, counts.GetValueOrDefault(t.Id), t.IsDeleted, t.CreatedAt, t.UpdatedAt)).ToList();
    }

    private static Guid? Normalize(Guid? id) => id is null || id == Guid.Empty ? null : id;

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
