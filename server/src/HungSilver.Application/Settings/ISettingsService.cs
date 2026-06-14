using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.Settings;

/// <summary>CRUD cấu hình có kiểm quyền theo scope. Đọc giá trị hiệu lực dùng ISettingsResolver.</summary>
public interface ISettingsService
{
    /// <summary>Giá trị cấu hình hiệu lực cho user hiện tại (kèm lớp tùy chọn).</summary>
    Task<Result<EffectiveSettingsDto>> GetEffectiveAsync(Guid? classId, CancellationToken ct = default);

    /// <summary>Danh sách setting thô của một scope (kiểm quyền: System/Role=Admin; Class=GV của lớp; User=chính mình).</summary>
    Task<Result<List<SettingDto>>> GetScopeAsync(SettingScope scope, Guid? scopeId, CancellationToken ct = default);

    Task<Result<SettingDto>> UpsertAsync(UpsertSettingRequest request, CancellationToken ct = default);

    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
}
