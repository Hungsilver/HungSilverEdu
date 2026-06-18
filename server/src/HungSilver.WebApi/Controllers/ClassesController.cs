using HungSilver.Application.Classes;
using HungSilver.Application.Common.Models;
using HungSilver.Application.Students;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/classes")]
[Authorize(Policy = "TeacherOrAdmin")]
public class ClassesController(
    IClassService classService,
    IStudentImportService importService,
    IClassImportService classImportService,
    IStudentAccountService studentAccountService) : ControllerBase
{
    /// <summary>Giáo viên/Admin tạo 1 học sinh trong lớp (kèm tài khoản đăng nhập nếu chọn).</summary>
    [HttpPost("{id:guid}/students")]
    public async Task<ActionResult<CreateClassStudentResultDto>> CreateStudent(
        Guid id, CreateClassStudentRequest request, CancellationToken ct) =>
        (await studentAccountService.CreateInClassAsync(id, request, ct)).ToActionResult();

    /// <summary>Tải file Excel mẫu để nhập học viên.</summary>
    [HttpGet("import-template")]
    public IActionResult ImportTemplate() =>
        File(importService.BuildTemplate(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "mau-hoc-vien.xlsx");

    /// <summary>Xem trước danh sách học viên từ file Excel (validate từng dòng).</summary>
    [HttpPost("{id:guid}/import-students/preview")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<StudentImportPreviewDto>> ImportPreview(Guid id, IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new ProblemDetails { Title = "Import.NoFile", Detail = "Chưa chọn file." });
        await using var stream = file.OpenReadStream();
        return (await importService.PreviewAsync(id, stream, ct)).ToActionResult();
    }

    /// <summary>Xác nhận nhập: tạo học viên + ghi danh (+ tạo tài khoản nếu chọn).</summary>
    [HttpPost("{id:guid}/import-students")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<StudentImportResultDto>> ImportCommit(
        Guid id, IFormFile file, [FromForm] bool createAccounts, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new ProblemDetails { Title = "Import.NoFile", Detail = "Chưa chọn file." });
        await using var stream = file.OpenReadStream();
        return (await importService.CommitAsync(id, stream, createAccounts, ct)).ToActionResult();
    }

    /// <summary>Tải file Excel mẫu để nhập danh sách lớp.</summary>
    [HttpGet("import-classes-template")]
    public IActionResult ImportClassesTemplate() =>
        File(classImportService.BuildTemplate(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "mau-danh-sach-lop.xlsx");

    /// <summary>Xem trước danh sách lớp từ file Excel (validate từng dòng).</summary>
    [HttpPost("import-classes/preview")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<ClassImportPreviewDto>> ImportClassesPreview(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new ProblemDetails { Title = "Import.NoFile", Detail = "Chưa chọn file." });
        await using var stream = file.OpenReadStream();
        return (await classImportService.PreviewAsync(stream, ct)).ToActionResult();
    }

    /// <summary>Xác nhận nhập: tạo các lớp hợp lệ.</summary>
    [HttpPost("import-classes")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<ClassImportResultDto>> ImportClassesCommit(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new ProblemDetails { Title = "Import.NoFile", Detail = "Chưa chọn file." });
        await using var stream = file.OpenReadStream();
        return (await classImportService.CommitAsync(stream, ct)).ToActionResult();
    }

    /// <summary>Admin: tất cả lớp; Teacher: chỉ lớp do mình phụ trách. Lọc theo môn/khối (Đợt 7).</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<ClassListItemDto>>> GetClasses(
        [FromQuery] PagedRequest request,
        [FromQuery] bool includeDeleted = false,
        [FromQuery] Guid? subjectId = null,
        [FromQuery] string? gradeBand = null,
        CancellationToken ct = default) =>
        (await classService.GetPagedAsync(request, includeDeleted, subjectId, gradeBand, ct)).ToActionResult();

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ClassDto>> GetClass(Guid id, CancellationToken ct) =>
        (await classService.GetByIdAsync(id, ct)).ToActionResult();

    [HttpGet("{id:guid}/roster")]
    public async Task<ActionResult<List<RosterItemDto>>> GetRoster(Guid id, CancellationToken ct) =>
        (await classService.GetRosterAsync(id, ct)).ToActionResult();

    /// <summary>Tình hình học tập từng học sinh trong lớp (điểm thưởng/phạt, chuyên cần, BTVN).</summary>
    [HttpGet("{id:guid}/overview")]
    public async Task<ActionResult<List<ClassStudentOverviewDto>>> GetOverview(Guid id, CancellationToken ct) =>
        (await classService.GetOverviewAsync(id, ct)).ToActionResult();

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<ClassDto>> Create(CreateClassRequest request, CancellationToken ct) =>
        (await classService.CreateAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<ClassDto>> Update(Guid id, UpdateClassRequest request, CancellationToken ct) =>
        (await classService.UpdateAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await classService.DeleteAsync(id, ct)).ToActionResult();

    [HttpPost("{id:guid}/restore")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Restore(Guid id, CancellationToken ct) =>
        (await classService.RestoreAsync(id, ct)).ToActionResult();

    [HttpPut("{id:guid}/teacher")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> AssignTeacher(Guid id, AssignTeacherRequest request, CancellationToken ct) =>
        (await classService.AssignTeacherAsync(id, request, ct)).ToActionResult();

    [HttpPost("{id:guid}/enroll")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Enroll(Guid id, EnrollStudentRequest request, CancellationToken ct) =>
        (await classService.EnrollAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}/students/{studentId:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Withdraw(Guid id, Guid studentId, CancellationToken ct) =>
        (await classService.WithdrawAsync(id, studentId, ct)).ToActionResult();
}
