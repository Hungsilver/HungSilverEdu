using HungSilver.Application.Abstractions;
using HungSilver.Application.AiCredentials;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Infrastructure.Ai;
using HungSilver.Infrastructure.AiCredentials;
using HungSilver.Infrastructure.Persistence;
using HungSilver.Infrastructure.Persistence.Interceptors;
using HungSilver.Infrastructure.Persistence.Repositories;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HungSilver.UnitTests;

/// <summary>
/// Kiểm thử cấu hình API Key AI: mã hóa khi lưu + chỉ trả key đã che ra DTO, upsert 1-1 theo UserId,
/// xóa mềm cho phép tạo lại, và validate cập nhật trạng thái từ kết quả gọi Gemini.
/// </summary>
public sealed class AiCredentialServiceTests : IDisposable
{
    private const string RawKey = "AIzaSyA1234567890_TESTKEY_abcd";

    private readonly SqliteConnection _connection;
    private readonly AppDbContext _context;
    private readonly FakeGemini _gemini = new();
    private readonly AiCredentialService _service;

    public AiCredentialServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .AddInterceptors(new AuditSaveChangesInterceptor())
            .Options;

        _context = new AppDbContext(options);
        _context.Database.EnsureCreated();

        _service = new AiCredentialService(
            new Repository<UserAiCredential>(_context),
            new UnitOfWork(_context),
            new ReversibleProtector(),
            _gemini,
            new SaveAiCredentialRequestValidator(),
            Microsoft.Extensions.Options.Options.Create(new GeminiOptions()));
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task Save_EncryptsKey_AndDtoExposesOnlyMasked()
    {
        var save = await _service.SaveAsync(Guid.NewGuid(), new SaveAiCredentialRequest(RawKey, "gemini-2.5-flash"));
        Assert.True(save.IsSuccess);

        // Row đã lưu: key đã mã hóa (khác key thô), chỉ giữ 4 ký tự cuối.
        var row = await _context.AiCredentials.IgnoreQueryFilters().SingleAsync();
        Assert.NotEqual(RawKey, row.ApiKeyEncrypted);
        Assert.Equal("abcd", row.KeyLast4);

        // DTO không bao giờ lộ key thô — chỉ dạng che.
        var dto = save.Value;
        Assert.True(dto.HasKey);
        Assert.Equal("••••••••abcd", dto.MaskedKey);
        Assert.DoesNotContain(RawKey, dto.MaskedKey!);
        Assert.Equal("gemini-2.5-flash", dto.Model);
    }

    [Fact]
    public async Task Get_NoKey_ReturnsHasKeyFalse()
    {
        var dto = (await _service.GetAsync(Guid.NewGuid())).Value;
        Assert.False(dto.HasKey);
        Assert.Null(dto.MaskedKey);
    }

    [Fact]
    public async Task Save_Twice_UpsertsSameRow()
    {
        var userId = Guid.NewGuid();
        await _service.SaveAsync(userId, new SaveAiCredentialRequest(RawKey, null));
        await _service.SaveAsync(userId, new SaveAiCredentialRequest("AIzaSyB_SECOND_KEY_wxyz", "gemini-2.5-pro"));

        Assert.Equal(1, await _context.AiCredentials.CountAsync(c => c.UserId == userId));

        // Resolver (seam tính năng AI tương lai) trả về key mới nhất sau khi giải mã.
        var resolved = await _service.GetApiKeyForUserAsync(userId);
        Assert.Equal("AIzaSyB_SECOND_KEY_wxyz", resolved.Value);
    }

    [Fact]
    public async Task Delete_ThenSaveAgain_IsAllowed()
    {
        var userId = Guid.NewGuid();
        await _service.SaveAsync(userId, new SaveAiCredentialRequest(RawKey, null));

        Assert.True((await _service.DeleteAsync(userId)).IsSuccess);

        // Tạo lại sau khi xóa mềm: không vướng unique index (filter loại bản đã xóa).
        var recreate = await _service.SaveAsync(userId, new SaveAiCredentialRequest("AIzaSyC_NEW_KEY_0000", null));
        Assert.True(recreate.IsSuccess);

        Assert.Equal(1, await _context.AiCredentials.CountAsync(c => c.UserId == userId));
        Assert.Equal(2, await _context.AiCredentials.IgnoreQueryFilters().CountAsync(c => c.UserId == userId));
    }

    [Fact]
    public async Task TwoLiveCredentials_SameUser_AreRejectedByIndex()
    {
        var userId = Guid.NewGuid();
        _context.AiCredentials.Add(new UserAiCredential { UserId = userId, ApiKeyEncrypted = "x" });
        await _context.SaveChangesAsync();

        _context.AiCredentials.Add(new UserAiCredential { UserId = userId, ApiKeyEncrypted = "y" });
        await Assert.ThrowsAsync<DbUpdateException>(() => _context.SaveChangesAsync());
    }

    [Fact]
    public async Task Validate_UpdatesStateFromGeminiResult()
    {
        var userId = Guid.NewGuid();
        await _service.SaveAsync(userId, new SaveAiCredentialRequest(RawKey, null));

        _gemini.NextResult = Result.Success();
        Assert.True((await _service.ValidateAsync(userId)).Value.IsValid);

        var row = await _context.AiCredentials.SingleAsync(c => c.UserId == userId);
        Assert.True(row.IsValid);
        Assert.NotNull(row.LastValidatedAt);

        _gemini.NextResult = Result.Failure(Error.Validation("Ai.InvalidKey", "Key sai."));
        Assert.False((await _service.ValidateAsync(userId)).Value.IsValid);
        Assert.False((await _context.AiCredentials.SingleAsync(c => c.UserId == userId)).IsValid);
    }

    // Mã hóa giả: đảo ngược được, đủ để kiểm "đã mã hóa khác key thô" + round-trip giải mã.
    private sealed class ReversibleProtector : ISecretProtector
    {
        private const string Prefix = "enc::";
        public string Protect(string plaintext) => Prefix + plaintext;
        public string Unprotect(string ciphertext) => ciphertext[Prefix.Length..];
    }

    private sealed class FakeGemini : IGeminiClient
    {
        public Result NextResult { get; set; } = Result.Success();
        public Task<Result> ValidateKeyAsync(string apiKey, CancellationToken ct = default) => Task.FromResult(NextResult);
        public Task<Result<string>> GenerateContentAsync(GeminiContentRequest request, CancellationToken ct = default)
            => Task.FromResult(Result.Failure<string>(Error.Failure("Ai.NotUsed", "Không dùng trong test này.")));
    }
}
