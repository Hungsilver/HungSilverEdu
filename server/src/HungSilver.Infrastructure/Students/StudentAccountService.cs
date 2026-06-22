using HungSilver.Application.Common;
using HungSilver.Application.Students;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Infrastructure.Identity;
using HungSilver.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Students;

public sealed class StudentAccountService(
    AppDbContext context,
    IClassAccessGuard accessGuard,
    UserManager<AppUser> userManager) : IStudentAccountService
{
    private static readonly Error StudentNotFound =
        Error.NotFound("Student.NotFound", "Không tìm thấy học sinh.");

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

        // Khi tạo tài khoản: bắt buộc có username + mật khẩu.
        if (request.CreateAccount)
        {
            if (string.IsNullOrWhiteSpace(request.UserName))
                return Result.Failure<CreateClassStudentResultDto>(Error.Validation("Student.UserNameRequired", "Vui lòng nhập tên đăng nhập cho học sinh."));
            if (string.IsNullOrWhiteSpace(request.Password))
                return Result.Failure<CreateClassStudentResultDto>(Error.Validation("Student.PasswordRequired", "Vui lòng nhập mật khẩu cho học sinh."));
        }

        // Lấy tên khối của lớp để sinh mã học viên theo rule.
        var classGrade = await context.Classes.AsNoTracking()
            .Where(c => c.Id == classId)
            .Select(c => c.GradeName)
            .FirstOrDefaultAsync(ct);

        var studentCode = await GenerateStudentCodeAsync(request.StudentCode, request.FullName, classGrade, ct);
        if (studentCode.IsFailure)
            return Result.Failure<CreateClassStudentResultDto>(studentCode.Error);
        var resolvedCode = studentCode.Value;

        var student = new Student
        {
            StudentCode = resolvedCode,
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

        var userName = request.UserName!.Trim();
        var email = userName.Contains('@') ? userName : $"{userName}@hocvien.local";

        if (await context.Users.IgnoreQueryFilters()
                .AnyAsync(u => u.NormalizedUserName == userManager.NormalizeName(userName), ct))
            return Result.Failure<CreateClassStudentResultDto>(Error.Conflict("Student.UserNameTaken", "Tên đăng nhập đã tồn tại, vui lòng chọn tên khác."));

        var user = new AppUser { UserName = userName, Email = email, FullName = student.FullName, EmailConfirmed = true };
        var created = await userManager.CreateAsync(user, request.Password!);
        if (!created.Succeeded)
            return Result.Failure<CreateClassStudentResultDto>(Error.Validation(
                "Student.AccountFailed", string.Join(" | ", created.Errors.Select(e => e.Description))));

        await userManager.AddToRoleAsync(user, AppRoles.User);

        student.UserId = user.Id;
        context.Students.Update(student);
        await context.SaveChangesAsync(ct);

        return new CreateClassStudentResultDto(student.Id, student.StudentCode, student.FullName, true, userName);
    }

    public async Task<Result> ResetPasswordAsync(Guid studentId, string newPassword, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(newPassword))
            return Result.Failure(Error.Validation("Student.PasswordRequired", "Vui lòng nhập mật khẩu mới."));

        // Admin/Teacher được đổi mật khẩu học sinh trong phạm vi nghiệp vụ toàn trung tâm.
        var access = await accessGuard.EnsureCanAccessStudentAsync(studentId, ct);
        if (access.IsFailure)
            return Result.Failure(access.Error);

        var student = await context.Students.FirstOrDefaultAsync(s => s.Id == studentId, ct);
        if (student is null)
            return Result.Failure(StudentNotFound);
        if (student.UserId is null)
            return Result.Failure(Error.Validation("Student.NoAccount", "Học sinh này chưa có tài khoản đăng nhập."));

        var user = await userManager.FindByIdAsync(student.UserId.Value.ToString());
        if (user is null)
            return Result.Failure(Error.Validation("Student.NoAccount", "Không tìm thấy tài khoản của học sinh."));

        var removed = await userManager.RemovePasswordAsync(user);
        if (!removed.Succeeded)
            return Result.Failure(Error.Failure("Student.ResetPasswordFailed",
                string.Join(" | ", removed.Errors.Select(e => e.Description))));

        var added = await userManager.AddPasswordAsync(user, newPassword);
        if (!added.Succeeded)
            return Result.Failure(Error.Validation("Student.ResetPasswordFailed",
                string.Join(" | ", added.Errors.Select(e => e.Description))));

        return Result.Success();
    }

    private async Task<Result<string>> GenerateStudentCodeAsync(string? requested, string fullName, string? gradeLevel, CancellationToken ct)
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
            var generated = NameCodeGenerator.GenerateStudentCode(fullName, gradeLevel, i);
            if (!await context.Students.IgnoreQueryFilters().AnyAsync(s => s.StudentCode == generated, ct))
                return generated;
        }
        return UniqueCodeGenerator.Next("HS");
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
