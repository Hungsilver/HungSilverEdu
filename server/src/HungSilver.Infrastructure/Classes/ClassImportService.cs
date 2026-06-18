using ClosedXML.Excel;
using HungSilver.Application.Classes;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Infrastructure.Identity;
using HungSilver.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Classes;

/// <summary>Nhập danh sách LỚP từ Excel (Đợt 7). Chỉ Admin (kiểm ở controller). Mirror StudentImportService.</summary>
public sealed class ClassImportService(
    AppDbContext context,
    UserManager<AppUser> userManager) : IClassImportService
{
    private static readonly string[] Headers =
    [
        "Tên lớp", "Môn", "Khối", "Giáo viên (email/username)",
        "Sĩ số tối đa", "Ngày khai giảng (dd/MM/yyyy)", "Giáo trình"
    ];

    public byte[] BuildTemplate()
    {
        using var wb = new XLWorkbook();
        var ws = wb.AddWorksheet("Lop");
        for (var i = 0; i < Headers.Length; i++)
            ws.Cell(1, i + 1).Value = Headers[i];
        ws.Row(1).Style.Font.Bold = true;

        ws.Cell(2, 1).Value = "Lớp 6A1";
        ws.Cell(2, 2).Value = "Tiếng Anh";
        ws.Cell(2, 3).Value = "Khối 6";
        ws.Cell(2, 4).Value = "teacher@hungsilver.local";
        ws.Cell(2, 5).Value = 15;
        ws.Cell(2, 6).Value = "01/09/2026";
        ws.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    public async Task<Result<ClassImportPreviewDto>> PreviewAsync(Stream file, CancellationToken ct = default)
    {
        var parse = await ParseAndValidateAsync(file, ct);
        if (parse.IsFailure)
            return Result.Failure<ClassImportPreviewDto>(parse.Error);

        var rows = parse.Value.Select(p => p.Dto).ToList();
        return new ClassImportPreviewDto(rows, rows.Count(r => r.IsValid), rows.Count(r => !r.IsValid));
    }

    public async Task<Result<ClassImportResultDto>> CommitAsync(Stream file, CancellationToken ct = default)
    {
        var parse = await ParseAndValidateAsync(file, ct);
        if (parse.IsFailure)
            return Result.Failure<ClassImportResultDto>(parse.Error);

        int created = 0, skipped = 0;
        var errors = new List<string>();

        foreach (var row in parse.Value)
        {
            if (!row.Dto.IsValid)
            {
                skipped++;
                if (row.Dto.Error is not null) errors.Add($"Dòng {row.Dto.RowNumber}: {row.Dto.Error}");
                continue;
            }

            try
            {
                context.Classes.Add(new ClassRoom
                {
                    Name = row.Dto.Name.Trim(),
                    TeacherId = row.TeacherId!.Value,
                    SubjectId = row.SubjectId,
                    GradeBand = string.IsNullOrWhiteSpace(row.Dto.GradeBand) ? null : row.Dto.GradeBand!.Trim(),
                    CurriculumId = row.CurriculumId,
                    MaxCapacity = row.MaxCapacity,
                    StartDate = row.StartDate,
                    IsActive = true
                });
                await context.SaveChangesAsync(ct);
                created++;
            }
            catch (Exception)
            {
                skipped++;
                errors.Add($"Dòng {row.Dto.RowNumber}: lỗi khi lưu, đã bỏ qua.");
            }
        }

        return new ClassImportResultDto(created, skipped, errors);
    }

    private async Task<Result<List<ParsedRow>>> ParseAndValidateAsync(Stream file, CancellationToken ct)
    {
        List<RawRow> raw;
        try
        {
            using var wb = new XLWorkbook(file);
            var ws = wb.Worksheets.First();
            raw = [];
            foreach (var row in ws.RowsUsed().Skip(1)) // bỏ dòng tiêu đề
            {
                raw.Add(new RawRow(
                    row.RowNumber(),
                    row.Cell(1).GetString().Trim(),
                    row.Cell(2).GetString().Trim(),
                    row.Cell(3).GetString().Trim(),
                    row.Cell(4).GetString().Trim(),
                    row.Cell(5).GetString().Trim(),
                    row.Cell(6).GetString().Trim(),
                    row.Cell(7).GetString().Trim()));
            }
        }
        catch
        {
            return Result.Failure<List<ParsedRow>>(
                Error.Validation("Import.BadFile", "Không đọc được file Excel. Hãy dùng đúng file mẫu (.xlsx)."));
        }

        if (raw.Count == 0)
            return Result.Failure<List<ParsedRow>>(
                Error.Validation("Import.Empty", "File không có dòng dữ liệu nào."));

        // Tra cứu Môn & Giáo trình theo tên (không phân biệt hoa thường).
        var subjects = await context.Subjects.AsNoTracking().ToListAsync(ct);
        var curriculums = await context.Curriculums.AsNoTracking().ToListAsync(ct);

        var result = new List<ParsedRow>();
        foreach (var r in raw)
        {
            string? error = null;
            Guid? subjectId = null;
            Guid? curriculumId = null;
            Guid? teacherId = null;
            var maxCapacity = 15;
            DateOnly? startDate = null;

            if (string.IsNullOrWhiteSpace(r.Name))
                error = "Thiếu tên lớp.";

            // Môn (bắt buộc).
            if (error is null)
            {
                if (string.IsNullOrWhiteSpace(r.Subject))
                    error = "Thiếu môn học.";
                else
                {
                    var s = subjects.FirstOrDefault(x => x.Name.Equals(r.Subject, StringComparison.OrdinalIgnoreCase));
                    if (s is null) error = $"Không tìm thấy môn '{r.Subject}'.";
                    else subjectId = s.Id;
                }
            }

            // Giáo viên (bắt buộc) — email hoặc username, phải là Teacher/Admin.
            if (error is null)
            {
                if (string.IsNullOrWhiteSpace(r.Teacher))
                    error = "Thiếu giáo viên.";
                else
                {
                    var user = await userManager.FindByEmailAsync(r.Teacher) ?? await userManager.FindByNameAsync(r.Teacher);
                    if (user is null)
                        error = $"Không tìm thấy người dùng '{r.Teacher}'.";
                    else if (!await userManager.IsInRoleAsync(user, AppRoles.Teacher) && !await userManager.IsInRoleAsync(user, AppRoles.Admin))
                        error = $"'{r.Teacher}' không có vai trò Giáo viên.";
                    else
                        teacherId = user.Id;
                }
            }

            // Sĩ số (tùy chọn, mặc định 15).
            if (error is null && !string.IsNullOrWhiteSpace(r.MaxCapacity))
            {
                if (!int.TryParse(r.MaxCapacity, out var cap) || cap <= 0 || cap > 1000)
                    error = "Sĩ số tối đa không hợp lệ (1–1000).";
                else
                    maxCapacity = cap;
            }

            // Ngày khai giảng (tùy chọn).
            if (error is null && !string.IsNullOrWhiteSpace(r.StartDate))
            {
                if (DateOnly.TryParseExact(r.StartDate, "dd/MM/yyyy", out var d))
                    startDate = d;
                else
                    error = "Ngày khai giảng sai định dạng (dd/MM/yyyy).";
            }

            // Giáo trình (tùy chọn) — không lỗi nếu không khớp.
            if (error is null && !string.IsNullOrWhiteSpace(r.Curriculum))
                curriculumId = curriculums.FirstOrDefault(c => c.Name.Equals(r.Curriculum, StringComparison.OrdinalIgnoreCase))?.Id;

            var dto = new ClassImportRowDto(
                r.RowNumber, r.Name, r.Subject, r.GradeBand, r.Teacher,
                r.MaxCapacity, r.StartDate, r.Curriculum, error is null, error);

            result.Add(new ParsedRow(dto, subjectId, teacherId, curriculumId, maxCapacity, startDate));
        }

        return result;
    }

    private sealed record RawRow(
        int RowNumber, string Name, string Subject, string GradeBand,
        string Teacher, string MaxCapacity, string StartDate, string Curriculum);

    private sealed record ParsedRow(
        ClassImportRowDto Dto, Guid? SubjectId, Guid? TeacherId, Guid? CurriculumId, int MaxCapacity, DateOnly? StartDate);
}
