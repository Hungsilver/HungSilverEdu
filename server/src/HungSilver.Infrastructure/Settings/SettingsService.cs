using System.Globalization;
using System.Text.Json;
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
    // Snapshot bảng Settings dùng lại trong CÙNG một request (service đăng ký Scoped).
    // Trước đây mỗi lần đọc cấu hình là một lần quét cả bảng, mà Dashboard/Tuition/Warnings
    // đọc nhiều lần trong một request. Ghi cấu hình sẽ xóa snapshot để lần đọc sau lấy giá trị mới.
    private List<AppSetting>? _snapshot;
    private readonly Dictionary<Guid, List<Guid>> _roleCache = [];

    private async Task<List<AppSetting>> SnapshotAsync(CancellationToken ct) =>
        _snapshot ??= await context.Settings.AsNoTracking().ToListAsync(ct);

    private void InvalidateSnapshot() => _snapshot = null;

    // ---------------- ISettingsResolver ----------------

    public async Task<string?> GetEffectiveValueAsync(string key, Guid? classId = null, Guid? userId = null, CancellationToken ct = default)
    {
        var uid = userId ?? currentUser.UserId;
        var roleIds = uid is null ? [] : await GetUserRoleIdsAsync(uid.Value, ct);

        var candidates = (await SnapshotAsync(ct)).Where(s => s.Key == key).ToList();
        var value = PickByPriority(key, candidates, classId, uid, roleIds);

        if (value is not null) return value;
        return SettingKeys.Defaults.TryGetValue(key, out var def) ? def : null;
    }

    public async Task<IReadOnlyDictionary<string, string>> GetEffectiveAllAsync(Guid? classId = null, Guid? userId = null, CancellationToken ct = default)
    {
        var uid = userId ?? currentUser.UserId;
        var roleIds = uid is null ? [] : await GetUserRoleIdsAsync(uid.Value, ct);

        var result = new Dictionary<string, string>(SettingKeys.Defaults);

        foreach (var grp in (await SnapshotAsync(ct)).GroupBy(s => s.Key))
        {
            var val = PickByPriority(grp.Key, grp.ToList(), classId, uid, roleIds);
            if (val is not null)
                result[grp.Key] = val;
        }

        return result;
    }

    private static string? PickByPriority(string key, List<AppSetting> candidates, Guid? classId, Guid? userId, List<Guid> roleIds)
    {
        // Khóa toàn hệ thống chỉ nhận scope System — không cho bản ghi User/Class/Role ghi đè chính sách chung.
        if (!SettingKeys.SystemOnly.Contains(key))
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
        }

        var system = candidates.FirstOrDefault(s => s.Scope == SettingScope.System);
        return system?.Value;
    }

    private async Task<List<Guid>> GetUserRoleIdsAsync(Guid userId, CancellationToken ct)
    {
        if (_roleCache.TryGetValue(userId, out var cached)) return cached;
        var ids = await (from ur in context.UserRoles where ur.UserId == userId select ur.RoleId).ToListAsync(ct);
        _roleCache[userId] = ids;
        return ids;
    }

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

        var key = request.Key.Trim();
        if (!SettingKeys.All.Contains(key))
            return Result.Failure<SettingDto>(Error.Validation(
                "Settings.UnknownKey", $"Khóa cấu hình \"{key}\" không được hỗ trợ."));

        var validation = await ValidateValueAsync(key, request.Value, ct);
        if (validation.IsFailure)
            return Result.Failure<SettingDto>(validation.Error);

        // Khóa toàn hệ thống chỉ được ghi ở scope System (đọc cũng chỉ đọc scope này).
        var scope = SettingKeys.SystemOnly.Contains(key) ? SettingScope.System : request.Scope;

        // Chuẩn hóa: scope User mà không truyền ScopeId thì mặc định là chính user hiện tại.
        var scopeId = scope == SettingScope.User && request.ScopeId is null
            ? currentUser.UserId
            : scope == SettingScope.System ? null : request.ScopeId;

        var permission = await CheckScopePermissionAsync(scope, scopeId, ct);
        if (permission.IsFailure)
            return Result.Failure<SettingDto>(permission.Error);

        var existing = await context.Settings.FirstOrDefaultAsync(
            s => s.Scope == scope && s.ScopeId == scopeId && s.Key == key, ct);

        if (existing is null)
        {
            existing = new AppSetting
            {
                Key = key,
                Value = request.Value,
                Scope = scope,
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
        InvalidateSnapshot();
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
        InvalidateSnapshot();
        return Result.Success();
    }

    // ---------------- validate theo từng khóa ----------------

    /// <summary>Giá trị hiệu lực ở scope System (bỏ qua mọi scope hẹp hơn) — dùng khi kiểm ràng buộc chéo khóa.</summary>
    private async Task<string> SystemValueAsync(string key, CancellationToken ct)
    {
        var row = (await SnapshotAsync(ct)).FirstOrDefault(s => s.Key == key && s.Scope == SettingScope.System);
        return row?.Value ?? SettingKeys.Defaults.GetValueOrDefault(key, string.Empty);
    }

    private async Task<Result> ValidateValueAsync(string key, string? value, CancellationToken ct)
    {
        var raw = value?.Trim() ?? string.Empty;

        switch (key)
        {
            case SettingKeys.FileStorageAllowServerUpload:
            case SettingKeys.FileStorageAllowExternalUrl:
            {
                if (!TryParseBool(raw, out var enabled))
                    return Invalid("Giá trị phải là true hoặc false.");

                // Không được tắt cả hai cách nạp tài liệu — nếu không sẽ không thêm được tài liệu nào.
                if (!enabled)
                {
                    var otherKey = key == SettingKeys.FileStorageAllowServerUpload
                        ? SettingKeys.FileStorageAllowExternalUrl
                        : SettingKeys.FileStorageAllowServerUpload;
                    if (!TryParseBool(await SystemValueAsync(otherKey, ct), out var otherEnabled) || !otherEnabled)
                        return Result.Failure(Error.Validation("Settings.NoUploadMethod",
                            "Phải bật ít nhất một cách nạp tài liệu (tải file lên server hoặc dán đường dẫn ngoài)."));
                }
                return Result.Success();
            }

            case SettingKeys.FileStorageDefaultSource:
            {
                if (raw is not (SettingKeys.SourceServerFile or SettingKeys.SourceExternalUrl))
                    return Invalid("Cách nạp mặc định phải là ServerFile hoặc ExternalUrl.");

                var needKey = raw == SettingKeys.SourceServerFile
                    ? SettingKeys.FileStorageAllowServerUpload
                    : SettingKeys.FileStorageAllowExternalUrl;
                if (!TryParseBool(await SystemValueAsync(needKey, ct), out var on) || !on)
                    return Result.Failure(Error.Validation("Settings.DefaultSourceDisabled",
                        "Cách nạp mặc định đang bị tắt. Hãy bật cách đó trước khi chọn làm mặc định."));
                return Result.Success();
            }

            case SettingKeys.AccountForceChangePassword:
                return TryParseBool(raw, out _) ? Result.Success() : Invalid("Giá trị phải là true hoặc false.");

            case SettingKeys.TuitionDueSoonDays:
                return int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var days) && days is >= 0 and <= 365
                    ? Result.Success()
                    : Invalid("Số ngày phải là số nguyên từ 0 đến 365.");

            case SettingKeys.WarningScoreDropThreshold:
                return decimal.TryParse(raw, NumberStyles.Number, CultureInfo.InvariantCulture, out var th) && th is >= 0 and <= 10
                    ? Result.Success()
                    : Invalid("Ngưỡng điểm phải là số từ 0 đến 10.");

            case SettingKeys.CenterCodePrefix:
                return raw.Length is > 0 and <= 30 ? Result.Success() : Invalid("Tiền tố mã phải từ 1 đến 30 ký tự.");

            case SettingKeys.AccountDefaultPassword:
                return IsStrongPassword(raw)
                    ? Result.Success()
                    : Invalid("Mật khẩu mặc định phải từ 8 ký tự, có chữ hoa, chữ thường và số.");

            case SettingKeys.ScheduleShifts:
                try { using var _ = JsonDocument.Parse(raw); return Result.Success(); }
                catch (JsonException) { return Invalid("Khung ca học phải là JSON hợp lệ."); }

            default:
                return Result.Success();
        }

        Result Invalid(string message) => Result.Failure(Error.Validation("Settings.InvalidValue", message));
    }

    private static bool TryParseBool(string? raw, out bool value) =>
        bool.TryParse(raw?.Trim(), out value);

    /// <summary>Khớp chính sách Identity đang cấu hình (≥8, có hoa/thường/số; không bắt ký tự đặc biệt).</summary>
    private static bool IsStrongPassword(string raw) =>
        raw.Length >= 8 && raw.Any(char.IsUpper) && raw.Any(char.IsLower) && raw.Any(char.IsDigit);

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
