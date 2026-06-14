using AutoMapper;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Application.Settings;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Settings;

/// <summary>Cấu hình phân tầng: vừa giải giá trị hiệu lực (resolver) vừa CRUD có kiểm quyền (service).</summary>
public sealed class SettingsService(
    AppDbContext context,
    ICurrentUser currentUser,
    IClassAccessGuard classAccessGuard,
    IMapper mapper) : ISettingsService, ISettingsResolver
{
    // ---------------- ISettingsResolver ----------------

    public async Task<string?> GetEffectiveValueAsync(string key, Guid? classId = null, Guid? userId = null, CancellationToken ct = default)
    {
        var uid = userId ?? currentUser.UserId;
        var roleIds = uid is null ? [] : await GetUserRoleIdsAsync(uid.Value, ct);

        var candidates = await context.Settings.Where(s => s.Key == key).ToListAsync(ct);
        var value = PickByPriority(candidates, classId, uid, roleIds);

        if (value is not null) return value;
        return SettingKeys.Defaults.TryGetValue(key, out var def) ? def : null;
    }

    public async Task<IReadOnlyDictionary<string, string>> GetEffectiveAllAsync(Guid? classId = null, Guid? userId = null, CancellationToken ct = default)
    {
        var uid = userId ?? currentUser.UserId;
        var roleIds = uid is null ? [] : await GetUserRoleIdsAsync(uid.Value, ct);

        var result = new Dictionary<string, string>(SettingKeys.Defaults);

        var all = await context.Settings.ToListAsync(ct);
        foreach (var grp in all.GroupBy(s => s.Key))
        {
            var val = PickByPriority(grp.ToList(), classId, uid, roleIds);
            if (val is not null)
                result[grp.Key] = val;
        }

        return result;
    }

    private static string? PickByPriority(List<AppSetting> candidates, Guid? classId, Guid? userId, List<Guid> roleIds)
    {
        if (userId is not null)
        {
            var user = candidates.FirstOrDefault(s => s.Scope == SettingScope.User && s.ScopeId == userId);
            if (user is not null) return user.Value;
        }

        if (classId is not null)
        {
            var cls = candidates.FirstOrDefault(s => s.Scope == SettingScope.Class && s.ScopeId == classId);
            if (cls is not null) return cls.Value;
        }

        var role = candidates.FirstOrDefault(s =>
            s.Scope == SettingScope.Role && s.ScopeId != null && roleIds.Contains(s.ScopeId.Value));
        if (role is not null) return role.Value;

        var system = candidates.FirstOrDefault(s => s.Scope == SettingScope.System);
        return system?.Value;
    }

    private Task<List<Guid>> GetUserRoleIdsAsync(Guid userId, CancellationToken ct) =>
        (from ur in context.UserRoles where ur.UserId == userId select ur.RoleId).ToListAsync(ct);

    // ---------------- ISettingsService ----------------

    public async Task<Result<EffectiveSettingsDto>> GetEffectiveAsync(Guid? classId, CancellationToken ct = default)
    {
        var values = await GetEffectiveAllAsync(classId, currentUser.UserId, ct);
        return new EffectiveSettingsDto(values);
    }

    public async Task<Result<List<SettingDto>>> GetScopeAsync(SettingScope scope, Guid? scopeId, CancellationToken ct = default)
    {
        var permission = await CheckScopePermissionAsync(scope, scopeId, ct);
        if (permission.IsFailure)
            return Result.Failure<List<SettingDto>>(permission.Error);

        var items = await context.Settings
            .Where(s => s.Scope == scope && s.ScopeId == scopeId)
            .OrderBy(s => s.Key)
            .ToListAsync(ct);

        return mapper.Map<List<SettingDto>>(items);
    }

    public async Task<Result<SettingDto>> UpsertAsync(UpsertSettingRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Key))
            return Result.Failure<SettingDto>(Error.Validation("Settings.KeyRequired", "Thiếu khóa cấu hình."));

        // Chuẩn hóa: scope User mà không truyền ScopeId thì mặc định là chính user hiện tại.
        var scopeId = request.Scope == SettingScope.User && request.ScopeId is null
            ? currentUser.UserId
            : request.ScopeId;

        var permission = await CheckScopePermissionAsync(request.Scope, scopeId, ct);
        if (permission.IsFailure)
            return Result.Failure<SettingDto>(permission.Error);

        var existing = await context.Settings.FirstOrDefaultAsync(
            s => s.Scope == request.Scope && s.ScopeId == scopeId && s.Key == request.Key, ct);

        if (existing is null)
        {
            existing = new AppSetting
            {
                Key = request.Key.Trim(),
                Value = request.Value,
                Scope = request.Scope,
                ScopeId = scopeId,
                DataType = request.DataType,
                Description = request.Description
            };
            context.Settings.Add(existing);
        }
        else
        {
            existing.Value = request.Value;
            existing.DataType = request.DataType;
            existing.Description = request.Description;
            context.Settings.Update(existing);
        }

        await context.SaveChangesAsync(ct);
        return mapper.Map<SettingDto>(existing);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var setting = await context.Settings.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (setting is null)
            return Result.Failure(Error.NotFound("Settings.NotFound", "Không tìm thấy cấu hình."));

        var permission = await CheckScopePermissionAsync(setting.Scope, setting.ScopeId, ct);
        if (permission.IsFailure)
            return permission;

        context.Settings.Remove(setting); // interceptor → soft delete
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    private async Task<Result> CheckScopePermissionAsync(SettingScope scope, Guid? scopeId, CancellationToken ct)
    {
        var isAdmin = currentUser.IsInRole(AppRoles.Admin);

        switch (scope)
        {
            case SettingScope.System:
            case SettingScope.Role:
                return isAdmin ? Result.Success() : Forbidden();

            case SettingScope.Class:
                if (scopeId is null)
                    return Result.Failure(Error.Validation("Settings.ScopeIdRequired", "Thiếu Id lớp cho cấu hình theo lớp."));
                return await classAccessGuard.EnsureCanAccessClassAsync(scopeId.Value, ct);

            case SettingScope.User:
                if (isAdmin) return Result.Success();
                return scopeId is null || scopeId == currentUser.UserId ? Result.Success() : Forbidden();

            default:
                return Forbidden();
        }
    }

    private static Result Forbidden() =>
        Result.Failure(Error.Forbidden("Settings.Forbidden", "Bạn không có quyền với cấu hình này."));
}
