namespace HungSilver.Application.Settings;

/// <summary>
/// Giải giá trị cấu hình hiệu lực theo độ ưu tiên: User > Class > Role(của user) > System > Default.
/// </summary>
public interface ISettingsResolver
{
    Task<string?> GetEffectiveValueAsync(string key, Guid? classId = null, Guid? userId = null, CancellationToken ct = default);

    Task<IReadOnlyDictionary<string, string>> GetEffectiveAllAsync(Guid? classId = null, Guid? userId = null, CancellationToken ct = default);
}
