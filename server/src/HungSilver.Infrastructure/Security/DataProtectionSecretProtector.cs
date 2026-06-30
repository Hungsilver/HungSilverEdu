using HungSilver.Application.Abstractions;
using Microsoft.AspNetCore.DataProtection;

namespace HungSilver.Infrastructure.Security;

/// <summary>
/// Mã hóa secret bằng ASP.NET Core Data Protection. Khóa được persist ra đĩa (volume bền vững) —
/// xem cấu hình <c>AddDataProtection</c> ở DependencyInjection. ⚠️ Mất khóa ⇒ không giải mã được key cũ.
/// </summary>
public sealed class DataProtectionSecretProtector : ISecretProtector
{
    private readonly IDataProtector _protector;

    public DataProtectionSecretProtector(IDataProtectionProvider provider)
        => _protector = provider.CreateProtector("HungSilver.AiCredential.v1");

    public string Protect(string plaintext) => _protector.Protect(plaintext);
    public string Unprotect(string ciphertext) => _protector.Unprotect(ciphertext);
}
