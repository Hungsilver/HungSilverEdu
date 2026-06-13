using FluentValidation;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Auth;
using HungSilver.Application.Common;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Infrastructure.Identity;
using HungSilver.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HungSilver.Infrastructure.Auth;

public sealed class AuthService(
    UserManager<AppUser> userManager,
    SignInManager<AppUser> signInManager,
    AppDbContext context,
    IJwtTokenService tokenService,
    IGoogleAuthVerifier googleVerifier,
    IOptions<JwtOptions> jwtOptions,
    IValidator<RegisterRequest> registerValidator,
    IValidator<LoginRequest> loginValidator) : IAuthService
{
    private const string GoogleProvider = "Google";

    private static readonly Error InvalidCredentials =
        Error.Unauthorized("Auth.InvalidCredentials", "Email hoặc mật khẩu không đúng.");

    private static readonly Error InvalidRefreshToken =
        Error.Unauthorized("Auth.InvalidRefreshToken", "Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.");

    public async Task<Result<AuthTokens>> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        var validation = await registerValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<AuthTokens>(validation.ToError("Auth.Validation"));

        // Kiểm tra cả user đã xóa mềm — email vẫn bị chiếm bởi unique index của Identity.
        var emailTaken = await context.Users.IgnoreQueryFilters()
            .AnyAsync(u => u.NormalizedEmail == userManager.NormalizeEmail(request.Email), ct);
        if (emailTaken)
            return Result.Failure<AuthTokens>(Error.Conflict("Auth.EmailTaken", "Email đã được sử dụng."));

        var user = new AppUser
        {
            UserName = request.Email,
            Email = request.Email,
            FullName = request.FullName.Trim()
        };

        var created = await userManager.CreateAsync(user, request.Password);
        if (!created.Succeeded)
            return Result.Failure<AuthTokens>(Error.Validation(
                "Auth.RegisterFailed",
                string.Join(" | ", created.Errors.Select(e => e.Description))));

        await userManager.AddToRoleAsync(user, AppRoles.User);

        return await IssueTokensAsync(user, ct);
    }

    public async Task<Result<AuthTokens>> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var validation = await loginValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<AuthTokens>(validation.ToError("Auth.Validation"));

        // FindByEmailAsync đi qua query filter nên user đã xóa mềm coi như không tồn tại.
        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is null)
            return Result.Failure<AuthTokens>(InvalidCredentials);

        var signIn = await signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (signIn.IsLockedOut)
            return Result.Failure<AuthTokens>(Error.Unauthorized(
                "Auth.LockedOut", "Tài khoản tạm khóa do đăng nhập sai nhiều lần. Thử lại sau ít phút."));
        if (!signIn.Succeeded)
            return Result.Failure<AuthTokens>(InvalidCredentials);

        return await IssueTokensAsync(user, ct);
    }

    public async Task<Result<AuthTokens>> GoogleLoginAsync(GoogleLoginRequest request, CancellationToken ct = default)
    {
        var verified = await googleVerifier.VerifyAsync(request.IdToken, ct);
        if (verified.IsFailure)
            return Result.Failure<AuthTokens>(verified.Error);

        var info = verified.Value;

        var user = await userManager.FindByLoginAsync(GoogleProvider, info.Subject);
        if (user is null)
        {
            user = await userManager.FindByEmailAsync(info.Email);
            if (user is null)
            {
                user = new AppUser
                {
                    UserName = info.Email,
                    Email = info.Email,
                    EmailConfirmed = true,
                    FullName = info.FullName,
                    AvatarUrl = info.PictureUrl
                };

                var created = await userManager.CreateAsync(user);
                if (!created.Succeeded)
                    return Result.Failure<AuthTokens>(Error.Failure(
                        "Auth.GoogleRegisterFailed",
                        string.Join(" | ", created.Errors.Select(e => e.Description))));

                await userManager.AddToRoleAsync(user, AppRoles.User);
            }

            await userManager.AddLoginAsync(user,
                new UserLoginInfo(GoogleProvider, info.Subject, GoogleProvider));
        }

        return await IssueTokensAsync(user, ct);
    }

    public async Task<Result<AuthTokens>> RefreshAsync(string refreshToken, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
            return Result.Failure<AuthTokens>(InvalidRefreshToken);

        var tokenHash = tokenService.HashToken(refreshToken);
        var stored = await context.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == tokenHash, ct);
        if (stored is null || !stored.IsActive)
            return Result.Failure<AuthTokens>(InvalidRefreshToken);

        var user = await userManager.FindByIdAsync(stored.UserId.ToString());
        if (user is null)
            return Result.Failure<AuthTokens>(InvalidRefreshToken);

        // Rotation: thu hồi token cũ ngay khi dùng.
        stored.RevokedAtUtc = DateTime.UtcNow;

        var tokens = await IssueTokensAsync(user, ct);
        if (tokens.IsSuccess)
            stored.ReplacedByTokenHash = tokenService.HashToken(tokens.Value.RefreshToken);

        await context.SaveChangesAsync(ct);
        return tokens;
    }

    public async Task<Result> LogoutAsync(string refreshToken, CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(refreshToken))
        {
            var tokenHash = tokenService.HashToken(refreshToken);
            var stored = await context.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == tokenHash, ct);
            if (stored is { RevokedAtUtc: null })
            {
                stored.RevokedAtUtc = DateTime.UtcNow;
                await context.SaveChangesAsync(ct);
            }
        }

        return Result.Success();
    }

    public async Task<Result<UserDto>> GetMeAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return Result.Failure<UserDto>(Error.NotFound("Auth.UserNotFound", "Không tìm thấy tài khoản."));

        return await ToUserDtoAsync(user);
    }

    private async Task<Result<AuthTokens>> IssueTokensAsync(AppUser user, CancellationToken ct)
    {
        var roles = await userManager.GetRolesAsync(user);
        var access = tokenService.CreateAccessToken(user.Id, user.Email!, user.FullName, roles);

        var refreshRaw = tokenService.CreateRefreshToken();
        var refreshExpiresAtUtc = DateTime.UtcNow.AddDays(jwtOptions.Value.RefreshTokenDays);

        context.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = tokenService.HashToken(refreshRaw),
            ExpiresAtUtc = refreshExpiresAtUtc
        });
        await context.SaveChangesAsync(ct);

        var userDto = new UserDto(user.Id, user.Email!, user.FullName, user.AvatarUrl, [.. roles]);
        return new AuthTokens(access.Token, access.ExpiresAtUtc, refreshRaw, refreshExpiresAtUtc, userDto);
    }

    private async Task<UserDto> ToUserDtoAsync(AppUser user)
    {
        var roles = await userManager.GetRolesAsync(user);
        return new UserDto(user.Id, user.Email!, user.FullName, user.AvatarUrl, [.. roles]);
    }
}
