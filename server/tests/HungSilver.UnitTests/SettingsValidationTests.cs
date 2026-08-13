using AutoMapper;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Application.Settings;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using HungSilver.Infrastructure.Persistence.Interceptors;
using HungSilver.Infrastructure.Settings;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>
/// Cấu hình hệ thống sau redesign: whitelist khóa, validate giá trị theo từng khóa,
/// KHÔNG cho tắt cả hai cách nạp tài liệu, và khóa toàn-hệ-thống chỉ giải ở scope System.
/// </summary>
public sealed class SettingsValidationTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;
    private readonly IMapper _mapper;

    public SettingsValidationTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection).AddInterceptors(new AuditSaveChangesInterceptor()).Options;
        _context = new AppDbContext(options);
        _context.Database.EnsureCreated();

        _mapper = new MapperConfiguration(cfg => cfg.CreateMap<AppSetting, SettingDto>()).CreateMapper();
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    private SettingsService Service() => new(_context, new AdminUser(), new AdminGuard(), _mapper);

    private static UpsertSettingRequest Sys(string key, string? value) =>
        new(key, value, SettingScope.System, null, null, null);

    private async Task SeedSystemAsync(string key, string value)
    {
        _context.Settings.Add(new AppSetting { Key = key, Value = value, Scope = SettingScope.System });
        await _context.SaveChangesAsync();
    }

    [Fact]
    public async Task Upsert_UnknownKey_IsRejected()
    {
        var result = await Service().UpsertAsync(Sys("Some.Random.Key", "x"));

        Assert.True(result.IsFailure);
        Assert.Equal("Settings.UnknownKey", result.Error.Code);
    }

    [Fact]
    public async Task Upsert_WeakDefaultPassword_IsRejected()
    {
        // Chính sách Identity: ≥8 ký tự, có hoa/thường/số.
        var weak = await Service().UpsertAsync(Sys(SettingKeys.AccountDefaultPassword, "abc123"));
        Assert.True(weak.IsFailure);
        Assert.Equal("Settings.InvalidValue", weak.Error.Code);

        var strong = await Service().UpsertAsync(Sys(SettingKeys.AccountDefaultPassword, "Hocvien@123"));
        Assert.True(strong.IsSuccess);
    }

    [Fact]
    public async Task Upsert_DisablingBothUploadMethods_IsRejected()
    {
        await SeedSystemAsync(SettingKeys.FileStorageAllowServerUpload, "true");
        await SeedSystemAsync(SettingKeys.FileStorageAllowExternalUrl, "true");

        // Tắt cách thứ nhất: còn cách thứ hai ⇒ hợp lệ.
        var first = await Service().UpsertAsync(Sys(SettingKeys.FileStorageAllowExternalUrl, "false"));
        Assert.True(first.IsSuccess);

        // Tắt nốt cách còn lại ⇒ chặn, nếu không sẽ không thêm được tài liệu nào.
        var second = await Service().UpsertAsync(Sys(SettingKeys.FileStorageAllowServerUpload, "false"));
        Assert.True(second.IsFailure);
        Assert.Equal("Settings.NoUploadMethod", second.Error.Code);
    }

    [Fact]
    public async Task Upsert_DefaultSourcePointingToDisabledMethod_IsRejected()
    {
        await SeedSystemAsync(SettingKeys.FileStorageAllowServerUpload, "false");
        await SeedSystemAsync(SettingKeys.FileStorageAllowExternalUrl, "true");

        var result = await Service().UpsertAsync(Sys(SettingKeys.FileStorageDefaultSource, SettingKeys.SourceServerFile));

        Assert.True(result.IsFailure);
        Assert.Equal("Settings.DefaultSourceDisabled", result.Error.Code);
    }

    [Fact]
    public async Task SystemOnlyKey_IgnoresUserScopedOverride()
    {
        var userId = AdminUser.Id;
        await SeedSystemAsync(SettingKeys.AccountDefaultPassword, "Hocvien@123");

        // Bản ghi scope User (dữ liệu cũ hoặc ai đó tạo tay) KHÔNG được ghi đè chính sách chung.
        _context.Settings.Add(new AppSetting
        {
            Key = SettingKeys.AccountDefaultPassword,
            Value = "Rieng@999",
            Scope = SettingScope.User,
            ScopeId = userId
        });
        await _context.SaveChangesAsync();

        var effective = await Service().GetEffectiveValueAsync(SettingKeys.AccountDefaultPassword, userId: userId);

        Assert.Equal("Hocvien@123", effective);
    }

    [Fact]
    public async Task NonSystemKey_StillHonorsUserScopedOverride()
    {
        var userId = AdminUser.Id;
        await SeedSystemAsync(SettingKeys.TuitionDueSoonDays, "7");
        _context.Settings.Add(new AppSetting
        {
            Key = SettingKeys.TuitionDueSoonDays,
            Value = "3",
            Scope = SettingScope.User,
            ScopeId = userId
        });
        await _context.SaveChangesAsync();

        var effective = await Service().GetEffectiveValueAsync(SettingKeys.TuitionDueSoonDays, userId: userId);

        Assert.Equal("3", effective);
    }

    // ----- Fakes -----

    private sealed class AdminUser : ICurrentUser
    {
        public static readonly Guid Id = Guid.NewGuid();
        public Guid? UserId => Id;
        public string? Email => "admin@hungsilver.local";
        public bool IsAuthenticated => true;
        public bool IsInRole(string role) => role == AppRoles.Admin;
    }

    private sealed class AdminGuard : IClassAccessGuard
    {
        public bool IsAdmin => true;
        public Task<Guid?> GetTeacherScopeIdAsync(CancellationToken ct = default) => Task.FromResult<Guid?>(null);
        public Task<List<Guid>> GetOwnedClassIdsAsync(CancellationToken ct = default) => Task.FromResult(new List<Guid>());
        public Task<Result> EnsureCanAccessClassAsync(Guid classId, CancellationToken ct = default) => Task.FromResult(Result.Success());
        public Task<bool> CanAccessClassAsync(Guid classId, CancellationToken ct = default) => Task.FromResult(true);
        public Task<Result> EnsureCanAccessStudentAsync(Guid studentId, CancellationToken ct = default) => Task.FromResult(Result.Success());
    }
}
