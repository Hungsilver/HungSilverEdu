namespace HungSilver.Infrastructure.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "HungSilver";
    public string Audience { get; set; } = "HungSilver.Client";
    public string Secret { get; set; } = string.Empty;
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 7;
}

public sealed class GoogleOptions
{
    public const string SectionName = "Google";

    public string ClientId { get; set; } = string.Empty;
}

/// <summary>Cờ bật/tắt tính năng xác thực. Mặc định KHÓA đăng ký — chỉ Admin tạo tài khoản.</summary>
public sealed class AuthFeatureOptions
{
    public const string SectionName = "Auth";

    /// <summary>Cho phép tự đăng ký (register + Google tự tạo tài khoản). Mặc định false.</summary>
    public bool AllowRegistration { get; set; }
}

public sealed class SeedOptions
{
    public const string SectionName = "Seed";

    /// <summary>Tên đăng nhập admin (đăng nhập bằng username, không cần email).</summary>
    public string AdminUserName { get; set; } = "admin";
    public string AdminEmail { get; set; } = "admin@gmail.com";
    public string AdminPassword { get; set; } = "Admin@a1";
    public string AdminFullName { get; set; } = "Quản trị viên";
}
