using HungSilver.Application.Account;
using HungSilver.Application.Auth;
using HungSilver.Application.Files;
using HungSilver.Domain.Common.Results;
using HungSilver.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;

namespace HungSilver.Infrastructure.Account;

public sealed class ProfileService(
    UserManager<AppUser> userManager,
    IFileService fileService) : IProfileService
{
    private static readonly Error UserNotFound =
        Error.NotFound("Profile.UserNotFound", "Không tìm thấy tài khoản.");

    public async Task<Result<UserDto>> UpdateAvatarAsync(
        Guid userId, Stream content, string fileName, string contentType, long length, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return Result.Failure<UserDto>(UserNotFound);

        // Ảnh đại diện luôn lưu server, không phụ thuộc cấu hình FileStorage.Mode.
        var upload = await fileService.UploadAsync(content, fileName, contentType, length, enforceStorageMode: false, ct);
        if (upload.IsFailure)
            return Result.Failure<UserDto>(upload.Error);

        user.AvatarUrl = upload.Value.Url;
        var updated = await userManager.UpdateAsync(user);
        if (!updated.Succeeded)
            return Result.Failure<UserDto>(Error.Failure(
                "Profile.UpdateFailed", string.Join(" | ", updated.Errors.Select(e => e.Description))));

        var roles = await userManager.GetRolesAsync(user);
        return new UserDto(user.Id, user.Email ?? user.UserName!, user.FullName, user.PhoneNumber, user.AvatarUrl, [.. roles]);
    }

    public async Task<Result<UserDto>> UpdateProfileAsync(
        Guid userId, UpdateProfileRequest request, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return Result.Failure<UserDto>(UserNotFound);

        user.FullName = request.FullName;
        user.PhoneNumber = request.PhoneNumber;

        var updated = await userManager.UpdateAsync(user);
        if (!updated.Succeeded)
            return Result.Failure<UserDto>(Error.Failure(
                "Profile.UpdateFailed", string.Join(" | ", updated.Errors.Select(e => e.Description))));

        var roles = await userManager.GetRolesAsync(user);
        return new UserDto(user.Id, user.Email ?? user.UserName!, user.FullName, user.PhoneNumber, user.AvatarUrl, [.. roles]);
    }

    public async Task<Result> ChangePasswordAsync(Guid userId, ChangeOwnPasswordRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword))
            return Result.Failure(Error.Validation("Profile.PasswordRequired", "Vui lòng nhập mật khẩu mới."));

        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return Result.Failure(UserNotFound);

        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword ?? string.Empty, request.NewPassword);
        if (!result.Succeeded)
            return Result.Failure(Error.Validation(
                "Profile.ChangePasswordFailed", string.Join(" | ", result.Errors.Select(e => e.Description))));

        return Result.Success();
    }
}
