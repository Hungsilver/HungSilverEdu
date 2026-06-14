using HungSilver.Domain.Enums;

namespace HungSilver.Application.Settings;

public sealed record SettingDto(
    Guid Id,
    string Key,
    string? Value,
    SettingScope Scope,
    Guid? ScopeId,
    string? DataType,
    string? Description);

public sealed record UpsertSettingRequest(
    string Key,
    string? Value,
    SettingScope Scope,
    Guid? ScopeId,
    string? DataType,
    string? Description);

/// <summary>Giá trị cấu hình hiệu lực (đã gộp theo độ ưu tiên) cho user hiện tại / lớp tùy chọn.</summary>
public sealed record EffectiveSettingsDto(IReadOnlyDictionary<string, string> Values);
