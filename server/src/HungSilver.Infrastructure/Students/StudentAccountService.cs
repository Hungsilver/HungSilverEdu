using HungSilver.Application.Accounts;
using HungSilver.Application.Common;
using HungSilver.Application.Students;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Students;

public sealed class StudentAccountService(
    AppDbContext context,
    IClassAccessGuard accessGuard,
    IAccountProvisioningService accountProvisioning) : IStudentAccountService
{
    public async Task<Result<CreateClassStudentResultDto>> CreateInClassAsync(
        Guid classId, CreateClassStudentRequest request, CancellationToken ct = default)
    {
        // Admin/Teacher thao tác nghiệp vụ toàn trung tâm; guard vẫn kiểm lớp tồn tại/quyền hợp lệ.
        var access = await accessGuard.EnsureCanAccessClassAsync(classId, ct);
        if (access.IsFailure)
            return Result.Failure<CreateClassStudentResultDto>(access.Error);

        if (!await context.Classes.AnyAsync(c => c.Id == classId, ct))
            return Result.Failure<CreateClassStudentResultDto>(Error.NotFound("Class.NotFound", "Không tìm thấy lớp học."));

        if (string.IsNullOrWhiteSpace(request.FullName))
            return Result.Failure<CreateClassStudentResultDto>(Error.Validation("Student.NameRequired", "Vui lòng nhập họ tên học sinh."));

        // Lấy tên khối của lớp để sinh mã học viên theo rule.
        var classGrade = await context.Classes.AsNoTracking()
            .Where(c => c.Id == classId)
            .Select(c => c.GradeName)
            .FirstOrDefaultAsync(ct);

        var studentCode = await GenerateStudentCodeAsync(request.StudentCode, request.FullName, request.DateOfBirth, classGrade, ct);
        if (studentCode.IsFailure)
            return Result.Failure<CreateClassStudentResultDto>(studentCode.Error);

        var student = new Student
        {
            StudentCode = studentCode.Value,
            FullName = request.FullName.Trim(),
            DateOfBirth = request.DateOfBirth,
            School = Clean(request.School),
            GradeLevel = Clean(request.GradeLevel),
            Phone = Clean(request.Phone),
            ParentName = Clean(request.ParentName),
            ParentPhone = Clean(request.ParentPhone),
            Email = Clean(request.Email),
            Note = Clean(request.Note),
            EnglishLevel = Clean(request.EnglishLevel),
            LearningGoal = Clean(request.LearningGoal),
            EnrollmentDate = DateOnly.FromDateTime(DateTime.Now),
            IsActive = true
        };
        context.Students.Add(student);
        await context.SaveChangesAsync(ct);

        context.Enrollments.Add(new Enrollment
        {
            ClassId = classId,
            StudentId = student.Id,
            EnrolledOn = DateOnly.FromDateTime(DateTime.Now),
            IsActive = true
        });
        await context.SaveChangesAsync(ct);

        if (!request.CreateAccount)
            return new CreateClassStudentResultDto(student.Id, student.StudentCode, student.FullName, false, null);

        // Cấp tài khoản qua service chung: tên đăng nhập = Mã HV, mật khẩu mặc định/nhập, bắt đổi lần đầu.
        // Best-effort: lỗi cấp tài khoản KHÔNG đảo ngược việc tạo học sinh đã ghi danh.
        var provision = await accountProvisioning.ProvisionStudentAsync(
            student.Id, new ProvisionAccountOptions(Password: request.Password), ct);

        return provision.IsSuccess
            ? new CreateClassStudentResultDto(student.Id, student.StudentCode, student.FullName, true, provision.Value.UserName)
            : new CreateClassStudentResultDto(student.Id, student.StudentCode, student.FullName, false, null, provision.Error.Message);
    }

    private async Task<Result<string>> GenerateStudentCodeAsync(string? requested, string fullName, DateOnly? dateOfBirth, string? gradeLevel, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(requested))
        {
            var manual = requested.Trim().ToUpperInvariant();
            return await context.Students.IgnoreQueryFilters().AnyAsync(s => s.StudentCode == manual, ct)
                ? Result.Failure<string>(Error.Conflict("Student.DuplicateCode", $"Mã học viên '{manual}' đã tồn tại."))
                : (Result<string>)manual;
        }
        for (var i = 0; i <= 99; i++)
        {
            var generated = NameCodeGenerator.GenerateStudentCode(fullName, dateOfBirth, gradeLevel, i);
            if (!await context.Students.IgnoreQueryFilters().AnyAsync(s => s.StudentCode == generated, ct))
                return generated;
        }
        return UniqueCodeGenerator.Next("HS");
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
