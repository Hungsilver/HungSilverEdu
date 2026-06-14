namespace HungSilver.Domain.Common;

public static class AppRoles
{
    public const string Admin = "Admin";
    public const string Teacher = "Teacher";

    /// <summary>Học sinh. Là role mặc định khi đăng ký tài khoản.</summary>
    public const string User = "User";

    public static readonly string[] All = [Admin, Teacher, User];
}
