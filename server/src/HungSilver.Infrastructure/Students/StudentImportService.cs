using ClosedXML.Excel;
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

public sealed class StudentImportService(
    AppDbContext context,
    IClassAccessGuard accessGuard,
    UserManager<AppUser> userManager) : IStudentImportService
{
    private const string DefaultPassword = "Hocvien@123";

    private static readonly string[] Headers =
    [
        "Họ tên", "Ngày sinh (dd/MM/yyyy)", "Trường", "SĐT học sinh",
        "Phụ huynh", "SĐT phụ huynh", "Trình độ", "Mục tiêu"
    ];

    public async Task<Result<StudentImportPreviewDto>> PreviewAsync(Guid classId, Stream file, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessClassAsync(classId, ct);
        if (access.IsFailure)
            return Result.Failure<StudentImportPreviewDto>(access.Error);

        var parse = Parse(file);
        if (parse.IsFailure)
            return Result.Failure<StudentImportPreviewDto>(parse.Error);

        var rows = parse.Value;
        return new StudentImportPreviewDto(rows, rows.Count(r => r.IsValid), rows.Count(r => !r.IsValid));
    }

    public async Task<Result<StudentImportResultDto>> CommitAsync(Guid classId, Stream file, bool createAccounts, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessClassAsync(classId, ct);
        if (access.IsFailure)
            return Result.Failure<StudentImportResultDto>(access.Error);

        if (!await context.Classes.AnyAsync(c => c.Id == classId, ct))
            return Result.Failure<StudentImportResultDto>(Error.NotFound("Class.NotFound", "Không tìm thấy lớp học."));

        var parse = Parse(file);
        if (parse.IsFailure)
            return Result.Failure<StudentImportResultDto>(parse.Error);

        int created = 0, accounts = 0, skipped = 0;
        var errors = new List<string>();

        foreach (var row in parse.Value)
        {
            if (!row.IsValid) { skipped++; continue; }

            try
            {
                var student = new Student
                {
                    FullName = row.FullName!.Trim(),
                    DateOfBirth = ParseDate(row.DateOfBirth),
                    School = Clean(row.School),
                    Phone = Clean(row.Phone),
                    ParentName = Clean(row.ParentName),
                    ParentPhone = Clean(row.ParentPhone),
                    EnglishLevel = Clean(row.EnglishLevel),
                    LearningGoal = Clean(row.LearningGoal),
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
                created++;

                if (createAccounts)
                {
                    var accountResult = await TryCreateAccountAsync(student, ct);
                    if (accountResult) accounts++;
                    else errors.Add($"Dòng {row.RowNumber}: không tạo được tài khoản cho '{student.FullName}'.");
                }
            }
            catch (Exception)
            {
                // Một dòng lỗi không làm hỏng cả lần nhập — ghi nhận & bỏ qua.
                skipped++;
                errors.Add($"Dòng {row.RowNumber}: lỗi khi lưu, đã bỏ qua.");
            }
        }

        return new StudentImportResultDto(created, accounts, skipped, errors);
    }

    public byte[] BuildTemplate()
    {
        using var wb = new XLWorkbook();
        var ws = wb.AddWorksheet("HocVien");
        for (var i = 0; i < Headers.Length; i++)
            ws.Cell(1, i + 1).Value = Headers[i];
        ws.Row(1).Style.Font.Bold = true;

        ws.Cell(2, 1).Value = "Nguyễn Văn A";
        ws.Cell(2, 2).Value = "01/09/2015";
        ws.Cell(2, 3).Value = "Tiểu học ABC";
        ws.Cell(2, 5).Value = "Nguyễn Văn B";
        ws.Cell(2, 6).Value = "0900000000";
        ws.Cell(2, 7).Value = "Movers";
        ws.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    private static Result<List<StudentImportRowDto>> Parse(Stream file)
    {
        List<StudentImportRowDto> rows;
        try
        {
            using var wb = new XLWorkbook(file);
            var ws = wb.Worksheets.First();
            rows = [];

            foreach (var row in ws.RowsUsed().Skip(1)) // bỏ dòng tiêu đề
            {
                var fullName = row.Cell(1).GetString().Trim();
                var dob = row.Cell(2).GetString().Trim();
                var rowNumber = row.RowNumber();

                string? error = null;
                if (string.IsNullOrWhiteSpace(fullName))
                    error = "Thiếu họ tên.";
                else if (!string.IsNullOrWhiteSpace(dob) && ParseDate(dob) is null)
                    error = "Ngày sinh sai định dạng (dd/MM/yyyy).";

                rows.Add(new StudentImportRowDto(
                    rowNumber,
                    fullName, dob,
                    row.Cell(3).GetString().Trim(),
                    row.Cell(4).GetString().Trim(),
                    row.Cell(5).GetString().Trim(),
                    row.Cell(6).GetString().Trim(),
                    row.Cell(7).GetString().Trim(),
                    row.Cell(8).GetString().Trim(),
                    error is null, error));
            }
        }
        catch
        {
            return Result.Failure<List<StudentImportRowDto>>(
                Error.Validation("Import.BadFile", "Không đọc được file Excel. Hãy dùng đúng file mẫu (.xlsx)."));
        }

        if (rows.Count == 0)
            return Result.Failure<List<StudentImportRowDto>>(
                Error.Validation("Import.Empty", "File không có dòng dữ liệu nào."));

        return rows;
    }

    private async Task<bool> TryCreateAccountAsync(Student student, CancellationToken ct)
    {
        var digits = new string((student.ParentPhone ?? student.Phone ?? "").Where(char.IsDigit).ToArray());
        var email = digits.Length >= 4 ? $"{digits}@hocvien.hungsilver.local" : $"hv{student.Id:N}@hocvien.hungsilver.local";

        // Trùng email (vd 2 HS cùng SĐT phụ huynh) ⇒ dùng email theo Id (luôn duy nhất).
        if (await userManager.FindByEmailAsync(email) is not null)
            email = $"hv{student.Id:N}@hocvien.hungsilver.local";

        var user = new AppUser { UserName = email, Email = email, FullName = student.FullName, EmailConfirmed = true };
        var create = await userManager.CreateAsync(user, DefaultPassword);
        if (!create.Succeeded)
            return false;

        var role = await userManager.AddToRoleAsync(user, AppRoles.User);
        if (!role.Succeeded)
            return false;

        student.UserId = user.Id;
        context.Students.Update(student);
        await context.SaveChangesAsync(ct);
        return true;
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static DateOnly? ParseDate(string? s) =>
        !string.IsNullOrWhiteSpace(s) && DateOnly.TryParseExact(s.Trim(), "dd/MM/yyyy", out var d) ? d : null;
}
