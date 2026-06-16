using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Students;

/// <summary>
/// Cấp/quản lý tài khoản đăng nhập của học sinh — do giáo viên (trong phạm vi lớp của mình) hoặc
/// admin thực hiện. Hiện thực ở Infrastructure vì cần UserManager của Identity.
/// </summary>
public interface IStudentAccountService
{
    /// <summary>Tạo học sinh + ghi danh vào lớp (kèm tài khoản đăng nhập nếu chọn).</summary>
    Task<Result<CreateClassStudentResultDto>> CreateInClassAsync(Guid classId, CreateClassStudentRequest request, CancellationToken ct = default);

    /// <summary>Đặt lại mật khẩu tài khoản học sinh (giáo viên chỉ đổi được học sinh trong lớp mình).</summary>
    Task<Result> ResetPasswordAsync(Guid studentId, string newPassword, CancellationToken ct = default);
}
