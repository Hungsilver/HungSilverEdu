using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace HungSilver.Application.Schedule;

/// <summary>
/// Phân giải "Ca" (khung giờ) cho buổi học từ cấu hình JSON <c>Schedule.Shifts</c>.
/// Cấu hình gồm danh sách Ca mặc định (<c>default</c>) + override theo từng cơ sở (<c>byBranch</c>).
/// Thuần (không phụ thuộc EF/HTTP); fail-safe: JSON sai/rỗng ⇒ coi như không có Ca (mọi buổi "chưa xếp").
/// </summary>
public sealed class ShiftResolver
{
    private readonly List<ShiftBand> _default;
    private readonly Dictionary<Guid, List<ShiftBand>> _byBranch;

    private ShiftResolver(List<ShiftBand> defaultBands, Dictionary<Guid, List<ShiftBand>> byBranch)
    {
        _default = defaultBands;
        _byBranch = byBranch;
    }

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    /// <summary>Parse cấu hình JSON. JSON null/rỗng/sai ⇒ resolver rỗng (an toàn, không ném).</summary>
    public static ShiftResolver Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new ShiftResolver([], []);

        try
        {
            var cfg = JsonSerializer.Deserialize<ShiftsConfig>(json, JsonOpts);
            if (cfg is null)
                return new ShiftResolver([], []);

            var byBranch = new Dictionary<Guid, List<ShiftBand>>();
            if (cfg.ByBranch is not null)
            {
                foreach (var (key, defs) in cfg.ByBranch)
                {
                    if (Guid.TryParse(key, out var branchId))
                        byBranch[branchId] = Normalize(defs);
                }
            }

            return new ShiftResolver(Normalize(cfg.Default), byBranch);
        }
        catch (JsonException)
        {
            return new ShiftResolver([], []);
        }
    }

    /// <summary>
    /// Xếp buổi (theo cơ sở + giờ bắt đầu) vào Ca. Cơ sở có override → dùng list riêng, còn lại dùng default.
    /// Không khớp Ca nào / không có giờ ⇒ <c>(null, int.MaxValue)</c> (FE gắn nhãn "Chưa xếp giờ", xếp cuối).
    /// </summary>
    public (string? Name, int Order) Resolve(Guid? branchId, TimeOnly? startTime)
    {
        if (startTime is null)
            return (null, int.MaxValue);

        var bands = branchId is Guid id && _byBranch.TryGetValue(id, out var custom) ? custom : _default;
        for (var i = 0; i < bands.Count; i++)
        {
            if (startTime.Value >= bands[i].From && startTime.Value < bands[i].To)
                return (bands[i].Name, i);
        }

        return (null, int.MaxValue);
    }

    /// <summary>Lọc bỏ Ca thiếu tên/giờ không hợp lệ; giữ thứ tự khai báo (thứ tự = ưu tiên hiển thị).</summary>
    private static List<ShiftBand> Normalize(List<ShiftDef>? defs)
    {
        var result = new List<ShiftBand>();
        if (defs is null)
            return result;

        foreach (var d in defs)
        {
            if (string.IsNullOrWhiteSpace(d.Name))
                continue;
            if (!TryParseTime(d.From, out var from) || !TryParseTime(d.To, out var to) || to <= from)
                continue;
            result.Add(new ShiftBand(d.Name.Trim(), from, to));
        }

        return result;
    }

    private static bool TryParseTime(string? value, out TimeOnly time)
    {
        time = default;
        return !string.IsNullOrWhiteSpace(value)
            && TimeOnly.TryParse(value, CultureInfo.InvariantCulture, out time);
    }

    private sealed record ShiftBand(string Name, TimeOnly From, TimeOnly To);

    private sealed class ShiftsConfig
    {
        [JsonPropertyName("default")]
        public List<ShiftDef>? Default { get; set; }

        [JsonPropertyName("byBranch")]
        public Dictionary<string, List<ShiftDef>>? ByBranch { get; set; }
    }

    private sealed class ShiftDef
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("from")]
        public string? From { get; set; }

        [JsonPropertyName("to")]
        public string? To { get; set; }
    }
}
