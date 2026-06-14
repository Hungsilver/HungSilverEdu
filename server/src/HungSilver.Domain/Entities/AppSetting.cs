using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>
/// Cấu hình phân tầng key-value. Giá trị hiệu lực giải theo độ ưu tiên: User > Class > Role > System.
/// ScopeId: null nếu System; = RoleId/ClassId/UserId tùy Scope.
/// </summary>
public class AppSetting : BaseEntity
{
    public string Key { get; set; } = string.Empty;
    public string? Value { get; set; }
    public SettingScope Scope { get; set; } = SettingScope.System;
    public Guid? ScopeId { get; set; }
    public string? DataType { get; set; }
    public string? Description { get; set; }
}
