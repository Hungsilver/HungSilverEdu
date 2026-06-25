using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Students;

/// <summary>
/// Tạo học sinh trong lớp (kèm tùy chọn cấp tài khoản). Vòng đời tài khoản (cấp/đặt lại/khóa/liên kết)
/// dùng <see cref="HungSilver.Application.Accounts.IAccountProvisioningService"/>.
/// </summary>
public interface IStudentAccountService
{
    /// <summary>Tạo học sinh + ghi danh vào lớp (kèm cấp tài khoản đăng nhập nếu chọn).</summary>
    Task<Result<CreateClassStudentResultDto>> CreateInClassAsync(Guid classId, CreateClassStudentRequest request, CancellationToken ct = default);
}
