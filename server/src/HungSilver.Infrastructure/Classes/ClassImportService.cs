using ClosedXML.Excel;
using HungSilver.Application.Classes;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Classes;

public sealed class ClassImportService(AppDbContext context) : IClassImportService
{
    private static readonly string[] MainHeaders =
    [
        "Cơ sở", "Mã học viên", "Tên học viên", "Ngày sinh (dd/MM/yyyy)", "Mã lớp", "Tên lớp",
        "Môn", "Khối", "Giáo viên", "SĐT phụ huynh", "SĐT học viên", "Ghi chú"
    ];

    public byte[] BuildTemplate()
    {
        using var wb = new XLWorkbook();
        var ws = wb.AddWorksheet("NhapLieu");
        for (var i = 0; i < MainHeaders.Length; i++)
            ws.Cell(1, i + 1).Value = MainHeaders[i];
        ws.Row(1).Style.Font.Bold = true;
        ws.Cell(2, 3).Value = "Nguyễn Văn A";
        ws.Cell(2, 4).Value = "01/09/2010";
        ws.Cell(2, 6).Value = "Lớp toán 11 cô Phượng";
        ws.Cell(2, 10).Value = "0900000000";

        AddLookupSheet(wb, "CoSo", context.Branches.AsNoTracking().OrderBy(x => x.IndexOrder).Select(x => $"{x.Code} - {x.Name}").ToList());
        AddLookupSheet(wb, "MonHoc", context.Subjects.AsNoTracking().OrderBy(x => x.IndexOrder).Select(x => x.Name).ToList());
        AddLookupSheet(wb, "Khoi", context.GradeCategories.AsNoTracking().OrderBy(x => x.IndexOrder).Select(x => x.Name).ToList());
        AddLookupSheet(wb, "GiaoVien", context.TeacherProfiles.AsNoTracking().OrderBy(x => x.FullName).Select(x => x.FullName).ToList());
        AddLookupSheet(wb, "LopHienCo", context.Classes.AsNoTracking().OrderBy(x => x.Name).Select(x => $"{x.ClassCode} - {x.Name}").ToList());

        AddDropdown(ws, "A2:A500", "CoSo");
        AddDropdown(ws, "G2:G500", "MonHoc");
        AddDropdown(ws, "H2:H500", "Khoi");
        AddDropdown(ws, "I2:I500", "GiaoVien");
        ws.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    public async Task<Result<ClassImportPreviewDto>> PreviewAsync(Stream file, CancellationToken ct = default)
    {
        List<RawRow> rows;
        try
        {
            using var wb = new XLWorkbook(file);
            var ws = wb.Worksheet("NhapLieu") ?? wb.Worksheets.First();
            rows = ws.RowsUsed().Skip(1)
                .Select(r => new RawRow(
                    r.RowNumber(),
                    Cell(r, 1), Cell(r, 2), Cell(r, 3), Cell(r, 4), Cell(r, 5),
                    Cell(r, 6), Cell(r, 7), Cell(r, 8), Cell(r, 9), Cell(r, 10), Cell(r, 11), Cell(r, 12)))
                .Where(r => !string.IsNullOrWhiteSpace(r.StudentName) || !string.IsNullOrWhiteSpace(r.ClassName) || !string.IsNullOrWhiteSpace(r.ClassCode))
                .ToList();
        }
        catch
        {
            return Result.Failure<ClassImportPreviewDto>(Error.Validation("Import.BadFile", "Không đọc được file Excel. Hãy dùng đúng file mẫu (.xlsx)."));
        }

        if (rows.Count == 0)
            return Result.Failure<ClassImportPreviewDto>(Error.Validation("Import.Empty", "File không có dòng dữ liệu nào."));

        var branches = await context.Branches.AsNoTracking().ToListAsync(ct);
        var subjects = await context.Subjects.AsNoTracking().ToListAsync(ct);
        var grades = await context.GradeCategories.AsNoTracking().ToListAsync(ct);
        var teachers = await context.TeacherProfiles.AsNoTracking().ToListAsync(ct);
        var existingClasses = await context.Classes.AsNoTracking().ToListAsync(ct);
        var existingStudentCodes = await context.Students.IgnoreQueryFilters().AsNoTracking().Select(s => s.StudentCode).ToListAsync(ct);
        var studentCodeSet = existingStudentCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);

        var classMap = new Dictionary<string, ClassImportClassPreviewDto>(StringComparer.OrdinalIgnoreCase);
        var students = new List<ClassImportStudentPreviewDto>();

        foreach (var row in rows)
        {
            var branch = FindBranch(branches, row.Branch);
            var subject = FindByName(subjects, row.Subject, s => s.Name);
            var grade = FindByName(grades, row.Grade, g => g.Name);
            var teacher = FindTeacher(teachers, row.Teacher);
            var existingClass = !string.IsNullOrWhiteSpace(row.ClassCode)
                ? existingClasses.FirstOrDefault(c => c.ClassCode.Equals(row.ClassCode.Trim(), StringComparison.OrdinalIgnoreCase))
                : null;

            var classError = existingClass != null ? null : ValidateClass(row, branch, subject, grade, teacher);
            var classKey = existingClass?.ClassCode
                ?? (!string.IsNullOrWhiteSpace(row.ClassCode)
                    ? row.ClassCode.Trim().ToUpperInvariant()
                    : $"{row.ClassName}|{branch?.Id}|{subject?.Id}|{grade?.Id}|{teacher?.Id}");
            var previewId = ToPreviewId(classKey);

            if (!classMap.ContainsKey(classKey))
            {
                classMap[classKey] = new ClassImportClassPreviewDto(
                    previewId,
                    existingClass?.ClassCode ?? Clean(row.ClassCode),
                    existingClass?.Name ?? row.ClassName.Trim(),
                    existingClass?.Id,
                    existingClass?.BranchId ?? branch?.Id,
                    existingClass?.BranchCode ?? branch?.Code,
                    existingClass?.BranchName ?? branch?.Name,
                    existingClass?.SubjectId ?? subject?.Id,
                    existingClass?.SubjectName ?? subject?.Name,
                    existingClass?.GradeId ?? grade?.Id,
                    existingClass?.GradeName ?? grade?.Name,
                    existingClass?.TeacherProfileId ?? teacher?.Id,
                    existingClass?.TeacherName ?? teacher?.FullName,
                    existingClass?.TuitionFee ?? 0,
                    classError is null,
                    classError);
            }

            string? studentError = null;
            if (string.IsNullOrWhiteSpace(row.StudentName))
                studentError = "Thiếu tên học viên.";
            else if (!string.IsNullOrWhiteSpace(row.StudentCode) && studentCodeSet.Contains(row.StudentCode.Trim()))
                studentError = $"Mã học viên '{row.StudentCode}' đã tồn tại.";
            else if (classError is not null)
                studentError = "Lớp của dòng này chưa hợp lệ.";

            students.Add(new ClassImportStudentPreviewDto(
                row.RowNumber, previewId, Clean(row.StudentCode), row.StudentName.Trim(),
                Clean(row.DateOfBirth), Clean(row.ParentPhone), Clean(row.Phone), Clean(row.Note), studentError is null, studentError));
        }

        var classes = classMap.Values.ToList();
        var invalid = classes.Count(c => !c.IsValid) + students.Count(s => !s.IsValid);
        return new ClassImportPreviewDto(
            classes, students,
            classes.Count(c => c.IsValid), students.Count(s => s.IsValid), invalid);
    }

    public async Task<Result<ClassImportResultDto>> CommitAsync(ClassImportCommitRequest request, CancellationToken ct = default)
    {
        var errors = new List<string>();
        var skipped = 0;
        var classCreated = 0;
        var studentCreated = 0;
        var enrollmentCreated = 0;

        var classByPreview = new Dictionary<string, Guid>();
        var gradeByPreview = request.Classes.ToDictionary(c => c.PreviewId, c => c.GradeName);
        foreach (var item in request.Classes)
        {
            if (!item.IsValid)
            {
                skipped++;
                if (item.Error is not null) errors.Add($"Lớp {item.Name}: {item.Error}");
                continue;
            }

            var classId = item.ExistingClassId;
            if (classId is null)
            {
                var duplicateCode = !string.IsNullOrWhiteSpace(item.ClassCode)
                    && await context.Classes.IgnoreQueryFilters().AnyAsync(c => c.ClassCode == item.ClassCode, ct);
                if (duplicateCode)
                {
                    skipped++;
                    errors.Add($"Lớp {item.Name}: mã lớp '{item.ClassCode}' đã tồn tại.");
                    continue;
                }

                var teacher = item.TeacherProfileId is null
                    ? null
                    : await context.TeacherProfiles.AsNoTracking().FirstOrDefaultAsync(t => t.Id == item.TeacherProfileId.Value, ct);
                var cls = new ClassRoom
                {
                    ClassCode = string.IsNullOrWhiteSpace(item.ClassCode) ? UniqueCodeGenerator.Next("LH") : item.ClassCode.Trim().ToUpperInvariant(),
                    Name = item.Name.Trim(),
                    TeacherProfileId = item.TeacherProfileId,
                    TeacherId = teacher?.UserId ?? Guid.Empty,
                    TeacherName = item.TeacherName,
                    BranchId = item.BranchId,
                    BranchCode = item.BranchCode,
                    BranchName = item.BranchName,
                    SubjectId = item.SubjectId,
                    SubjectName = item.SubjectName,
                    GradeId = item.GradeId,
                    GradeName = item.GradeName,
                    GradeBand = item.GradeName,
                    TuitionFee = item.TuitionFee,
                    MaxCapacity = 1000,
                    IsActive = true
                };
                context.Classes.Add(cls);
                await context.SaveChangesAsync(ct);
                classId = cls.Id;
                classCreated++;
            }
            classByPreview[item.PreviewId] = classId.Value;
        }

        foreach (var row in request.Students)
        {
            if (!row.IsValid || !classByPreview.TryGetValue(row.PreviewClassId, out var classId))
            {
                skipped++;
                if (row.Error is not null) errors.Add($"Dòng {row.RowNumber}: {row.Error}");
                continue;
            }

            string code;
            if (!string.IsNullOrWhiteSpace(row.StudentCode))
            {
                code = row.StudentCode.Trim().ToUpperInvariant();
                if (await context.Students.IgnoreQueryFilters().AnyAsync(s => s.StudentCode == code, ct))
                {
                    skipped++;
                    errors.Add($"Dòng {row.RowNumber}: mã học viên '{code}' đã tồn tại.");
                    continue;
                }
            }
            else
            {
                var gradeName = gradeByPreview.GetValueOrDefault(row.PreviewClassId);
                var dob = ParseDate(row.DateOfBirth);
                code = await ResolveStudentCodeAsync(row.FullName, dob, gradeName, ct);
            }

            var dobForStudent = ParseDate(row.DateOfBirth);
            var student = new Student
            {
                StudentCode = code,
                FullName = row.FullName.Trim(),
                DateOfBirth = dobForStudent,
                ParentPhone = Clean(row.ParentPhone),
                Phone = Clean(row.Phone),
                Note = Clean(row.Note),
                EnrollmentDate = DateOnly.FromDateTime(DateTime.Now),
                IsActive = true
            };
            context.Students.Add(student);
            context.Enrollments.Add(new Enrollment
            {
                ClassId = classId,
                StudentId = student.Id,
                EnrolledOn = DateOnly.FromDateTime(DateTime.Now),
                IsActive = true
            });
            await context.SaveChangesAsync(ct);
            studentCreated++;
            enrollmentCreated++;
        }

        return new ClassImportResultDto(classCreated, studentCreated, enrollmentCreated, skipped, errors);
    }

    private static void AddLookupSheet(XLWorkbook wb, string name, List<string> values)
    {
        var ws = wb.AddWorksheet(name);
        ws.Cell(1, 1).Value = name;
        ws.Row(1).Style.Font.Bold = true;
        for (var i = 0; i < values.Count; i++)
            ws.Cell(i + 2, 1).Value = values[i];
        ws.Columns().AdjustToContents();
    }

    private static void AddDropdown(IXLWorksheet ws, string range, string sheetName)
    {
        var validation = ws.Range(range).CreateDataValidation();
        validation.List($"={sheetName}!$A$2:$A$500");
        validation.IgnoreBlanks = true;
        validation.InCellDropdown = true;
    }

    private static string? ValidateClass(RawRow row, Branch? branch, Subject? subject, GradeCategory? grade, TeacherProfile? teacher)
    {
        if (string.IsNullOrWhiteSpace(row.ClassName) && string.IsNullOrWhiteSpace(row.ClassCode))
            return "Thiếu tên lớp hoặc mã lớp.";
        if (branch is null)
            return "Cơ sở không hợp lệ.";
        if (subject is null)
            return "Môn học không hợp lệ.";
        if (grade is null)
            return "Khối không hợp lệ.";
        if (teacher is null)
            return "Giáo viên không hợp lệ.";
        return null;
    }

    private static Branch? FindBranch(List<Branch> items, string value)
    {
        var s = CleanLookup(value);
        return items.FirstOrDefault(x =>
            x.Code.Equals(s, StringComparison.OrdinalIgnoreCase)
            || x.Name.Equals(s, StringComparison.OrdinalIgnoreCase)
            || $"{x.Code} - {x.Name}".Equals(s, StringComparison.OrdinalIgnoreCase));
    }

    private static TeacherProfile? FindTeacher(List<TeacherProfile> items, string value)
    {
        var s = CleanLookup(value);
        return items.FirstOrDefault(x =>
            x.TeacherCode.Equals(s, StringComparison.OrdinalIgnoreCase)
            || x.FullName.Equals(s, StringComparison.OrdinalIgnoreCase)
            || $"{x.TeacherCode} - {x.FullName}".Equals(s, StringComparison.OrdinalIgnoreCase));
    }

    private static T? FindByName<T>(List<T> items, string value, Func<T, string> selector)
        where T : class
    {
        var s = CleanLookup(value);
        return items.FirstOrDefault(x => selector(x).Equals(s, StringComparison.OrdinalIgnoreCase));
    }

    private static string ToPreviewId(string key) => Convert.ToHexString(System.Text.Encoding.UTF8.GetBytes(key)).ToLowerInvariant();

    private static string Cell(IXLRow row, int index) => row.Cell(index).GetString().Trim();

    private static string CleanLookup(string? s) => string.IsNullOrWhiteSpace(s) ? string.Empty : s.Trim();

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

    private static DateOnly? ParseDate(string? s) =>
        !string.IsNullOrWhiteSpace(s) && DateOnly.TryParseExact(s.Trim(), "dd/MM/yyyy", out var d) ? d : null;

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private sealed record RawRow(
        int RowNumber,
        string Branch,
        string StudentCode,
        string StudentName,
        string DateOfBirth,
        string ClassCode,
        string ClassName,
        string Subject,
        string Grade,
        string Teacher,
        string ParentPhone,
        string Phone,
        string Note);
}
