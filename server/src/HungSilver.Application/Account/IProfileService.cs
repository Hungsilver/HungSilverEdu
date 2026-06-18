using HungSilver.Application.Auth;
using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Account;

/// <summary>Trang cá nhân của chính người dùng đang đăng nhập: ảnh đại diện + đổi mật khẩu.</summary>
public interface IProfileService
{
    /// <summary>Upload ảnh đại diện lên server và gắn vào tài khoản; trả thông tin user mới.</summary>
    Task<Result<UserDto>> UpdateAvatarAsync(Guid userId, Stream content, string fileName, string contentType, long length, CancellationToken ct = default);

    /// <summary>Cập nhật họ tên + số điện thoại.</summary>
    Task<Result<UserDto>> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken ct = default);

    /// <summary>Người dùng tự đổi mật khẩu của chính mình.</summary>
    Task<Result> ChangePasswordAsync(Guid userId, ChangeOwnPasswordRequest request, CancellationToken ct = default);
}

public sealed record UpdateProfileRequest(string? FullName, string? PhoneNumber);
public sealed record ChangeOwnPasswordRequest(string CurrentPassword, string NewPassword);
