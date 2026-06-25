using ClosedXML.Excel;
using HungSilver.Application.Accounts;
using HungSilver.Application.Common;
using HungSilver.Application.Students;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Students;

public sealed class StudentImportService(
    AppDbContext context,
    IClassAccessGuard accessGuard,
    IAccountProvisioningService accountProvisioning) : IStudentImportService
{
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

        var classGrade = await context.Classes.AsNoTracking()
            .Where(c => c.Id == classId)
            .Select(c => c.GradeName)
            .FirstOrDefaultAsync(ct);
        if (classGrade == null && !await context.Classes.AnyAsync(c => c.Id == classId, ct))
            return Result.Failure<StudentImportResultDto>(Error.NotFound("Class.NotFound", "Không tìm thấy lớp học."));

        var parse = Parse(file);
        if (parse.IsFailure)
            return Result.Failure<StudentImportResultDto>(parse.Error);

        int created = 0, accounts = 0, skipped = 0;
        var errors = new List<string>();

        foreach (var row in parse.Value)
        {
            if (!row.IsValid) { skipped++; continue; }

            var dob = ParseDate(row.DateOfBirth);
            var resolvedCode = await ResolveStudentCodeAsync(row.FullName!, dob, classGrade, ct);
            var student = new Student
            {
                StudentCode = resolvedCode,
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
            var enrollment = new Enrollment
            {
                ClassId = classId,
                StudentId = student.Id, // Id sinh sẵn (BaseEntity) ⇒ thêm cả 2 rồi lưu 1 lần.
                EnrolledOn = DateOnly.FromDateTime(DateTime.Now),
                IsActive = true
            };
            context.Students.Add(student);
            context.Enrollments.Add(enrollment);

            try
            {
                // Một SaveChanges = một transaction ⇒ HS + ghi danh hoặc cùng có hoặc cùng không (không mồ côi).
                await context.SaveChangesAsync(ct);
                created++;
            }
            catch (Exception)
            {
                // Gỡ theo dõi để dòng lỗi không kéo theo các dòng sau; ghi nhận & bỏ qua.
                context.Entry(student).State = EntityState.Detached;
                context.Entry(enrollment).State = EntityState.Detached;
                skipped++;
                errors.Add($"Dòng {row.RowNumber}: lỗi khi lưu, đã bỏ qua.");
                continue;
            }

            // Tạo tài khoản là tùy chọn & best-effort: lỗi ở đây KHÔNG đảo ngược việc tạo HS đã ghi danh.
            if (createAccounts)
            {
                try
                {
                    if (await TryCreateAccountAsync(student, ct)) accounts++;
                    else errors.Add($"Dòng {row.RowNumber}: không tạo được tài khoản cho '{student.FullName}'.");
                }
                catch (Exception)
                {
                    errors.Add($"Dòng {row.RowNumber}: lỗi khi tạo tài khoản cho '{student.FullName}'.");
                }
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
        ws.Cell(2, 4).SetValue("0900000000");
        ws.Cell(2, 5).Value = "Nguyễn Văn B";
        ws.Cell(2, 6).SetValue("0900000000");
        ws.Cell(2, 7).Value = "Movers";
        ApplyTextFormat(ws, [4, 6], 2, 500);
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

    // Cấp tài khoản qua service chung: tên đăng nhập = Mã HV, mật khẩu mặc định, bắt đổi lần đầu.
    private async Task<bool> TryCreateAccountAsync(Student student, CancellationToken ct) =>
        (await accountProvisioning.ProvisionStudentAsync(student.Id, ct: ct)).IsSuccess;

    private async Task<string> ResolveStudentCodeAsync(string fullName, DateOnly? dateOfBirth, string? gradeLevel, CancellationToken ct)
    {
        for (var i = 0; i <= 99; i++)
        {
            var generated = NameCodeGenerator.GenerateStudentCode(fullName, dateOfBirth, gradeLevel, i);
            if (!await context.Students.IgnoreQueryFilters().AnyAsync(s => s.StudentCode == generated, ct))
                return generated;
        }
        return UniqueCodeGenerator.Next("HS");
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static DateOnly? ParseDate(string? s) =>
        !string.IsNullOrWhiteSpace(s) && DateOnly.TryParseExact(s.Trim(), "dd/MM/yyyy", out var d) ? d : null;

    private static void ApplyTextFormat(IXLWorksheet ws, int[] columns, int firstRow, int lastRow)
    {
        foreach (var column in columns)
        {
            var range = ws.Range(firstRow, column, lastRow, column);
            range.Style.NumberFormat.Format = "@";
        }
    }
}
