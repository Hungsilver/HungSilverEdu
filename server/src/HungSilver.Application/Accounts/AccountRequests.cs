namespace HungSilver.Application.Accounts;

/// <summary>Cấp tài khoản cho một HS/GV. Mật khẩu trống ⇒ dùng mật khẩu mặc định.</summary>
public sealed record ProvisionAccountRequest(string? Password = null, string? LoginEmail = null);

/// <summary>Đặt lại mật khẩu. Trống ⇒ về mật khẩu mặc định + bắt đổi lần đầu.</summary>
public sealed record ResetPasswordRequest(string? Password = null);

public sealed record SetAccountLockedRequest(bool Locked);

/// <summary>Cấp tài khoản hàng loạt cho danh sách HS/GV (theo Id hồ sơ). Mật khẩu trống ⇒ mặc định.</summary>
public sealed record BulkProvisionRequest(IReadOnlyList<Guid> Ids, string? Password = null);
