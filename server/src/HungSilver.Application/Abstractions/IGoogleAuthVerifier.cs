using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Abstractions;

public sealed record GoogleUserInfo(string Subject, string Email, string? FullName, string? PictureUrl);

public interface IGoogleAuthVerifier
{
    Task<Result<GoogleUserInfo>> VerifyAsync(string idToken, CancellationToken ct = default);
}
