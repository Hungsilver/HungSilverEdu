using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Accounts;

/// <summary>
/// Nguồn sự thật DUY NHẤT cho vòng đời tài khoản đăng nhập của Học sinh &amp; Giáo viên.
/// Quy ước thống nhất: username = mã (StudentCode/TeacherCode); mật khẩu = giá trị mặc định
/// cấu hình được (hoặc người cấp nhập) + bắt buộc đổi ở lần đăng nhập đầu; mỗi entity ↔ tối đa
/// một tài khoản (1-1, enforce ở cả app lẫn DB). Hiện thực ở Infrastructure (cần UserManager).
/// </summary>
public interface IAccountProvisioningService
{
    // ----- Học sinh (TeacherOrAdmin; service tự kiểm phạm vi lớp của giáo viên) -----

    /// <summary>Cấp tài khoản đăng nhập (role User) cho học sinh. username = StudentCode.</summary>
    Task<Result<AccountProvisionResultDto>> ProvisionStudentAsync(Guid studentId, ProvisionAccountOptions? options = null, CancellationToken ct = default);

    /// <summary>Cấp tài khoản hàng loạt cho nhiều học sinh (best-effort, trả kết quả từng dòng).</summary>
    Task<BulkProvisionResultDto> ProvisionStudentsAsync(IReadOnlyCollection<Guid> studentIds, ProvisionAccountOptions? options = null, CancellationToken ct = default);

    /// <summary>Đặt lại mật khẩu tài khoản học sinh (null = dùng mật khẩu mặc định). Bắt đổi lần đầu.</summary>
    Task<Result> ResetStudentPasswordAsync(Guid studentId, string? newPassword = null, CancellationToken ct = default);

    /// <summary>Khóa/mở khóa đăng nhập tài khoản học sinh (dùng cơ chế lockout của Identity).</summary>
    Task<Result> SetStudentLockedAsync(Guid studentId, bool locked, CancellationToken ct = default);

    /// <summary>Gỡ liên kết tài khoản khỏi học sinh (Student.UserId = null). Không xóa tài khoản.</summary>
    Task<Result> UnlinkStudentAsync(Guid studentId, CancellationToken ct = default);

    /// <summary>Liên kết học sinh với một tài khoản (role User) đã tồn tại — enforce 1-1.</summary>
    Task<Result> LinkStudentAsync(Guid studentId, Guid userId, CancellationToken ct = default);

    // ----- Giáo viên (AdminOnly) -----

    /// <summary>Cấp tài khoản đăng nhập (role Teacher) cho giáo viên. username = TeacherCode.</summary>
    Task<Result<AccountProvisionResultDto>> ProvisionTeacherAsync(Guid teacherProfileId, ProvisionAccountOptions? options = null, CancellationToken ct = default);

    /// <summary>Cấp tài khoản hàng loạt cho nhiều giáo viên (best-effort).</summary>
    Task<BulkProvisionResultDto> ProvisionTeachersAsync(IReadOnlyCollection<Guid> teacherProfileIds, ProvisionAccountOptions? options = null, CancellationToken ct = default);

    /// <summary>Đặt lại mật khẩu tài khoản giáo viên (null = mật khẩu mặc định). Bắt đổi lần đầu.</summary>
    Task<Result> ResetTeacherPasswordAsync(Guid teacherProfileId, string? newPassword = null, CancellationToken ct = default);

    /// <summary>Khóa/mở khóa đăng nhập tài khoản giáo viên.</summary>
    Task<Result> SetTeacherLockedAsync(Guid teacherProfileId, bool locked, CancellationToken ct = default);
}

/// <summary>Tùy chọn khi cấp/đặt lại tài khoản.</summary>
/// <param name="Password">Mật khẩu khởi tạo; null/trống ⇒ dùng mật khẩu mặc định cấu hình.</param>
/// <param name="LoginEmail">Email đăng nhập tùy chọn; null ⇒ ưu tiên email hồ sơ (nếu có &amp; chưa dùng) rồi email ảo.</param>
/// <param name="MustChangePassword">Bắt buộc đổi mật khẩu lần đầu (mặc định true).</param>
public sealed record ProvisionAccountOptions(
    string? Password = null,
    string? LoginEmail = null,
    bool MustChangePassword = true);

public sealed record AccountProvisionResultDto(Guid UserId, string UserName, bool MustChangePassword);

public sealed record BulkProvisionItemDto(Guid Id, bool Success, string? UserName, string? Error);

public sealed record BulkProvisionResultDto(int Total, int Succeeded, int Failed, IReadOnlyList<BulkProvisionItemDto> Items);
