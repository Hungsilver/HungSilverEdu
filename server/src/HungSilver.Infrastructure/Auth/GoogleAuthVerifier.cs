using Google.Apis.Auth;
using HungSilver.Application.Abstractions;
using HungSilver.Domain.Common.Results;
using Microsoft.Extensions.Options;

namespace HungSilver.Infrastructure.Auth;

public sealed class GoogleAuthVerifier(IOptions<GoogleOptions> options) : IGoogleAuthVerifier
{
    private readonly GoogleOptions _options = options.Value;

    public async Task<Result<GoogleUserInfo>> VerifyAsync(string idToken, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_options.ClientId))
        {
            return Result.Failure<GoogleUserInfo>(Error.Failure(
                "Google.NotConfigured",
                "Google ClientId chưa được cấu hình (Google__ClientId)."));
        }

        try
        {
            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = [_options.ClientId]
            });

            return new GoogleUserInfo(payload.Subject, payload.Email, payload.Name, payload.Picture);
        }
        catch (InvalidJwtException)
        {
            return Result.Failure<GoogleUserInfo>(Error.Unauthorized(
                "Google.InvalidToken",
                "Google ID token không hợp lệ hoặc đã hết hạn."));
        }
    }
}
