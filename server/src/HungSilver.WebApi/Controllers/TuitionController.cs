using HungSilver.Application.Common.Models;
using HungSilver.Application.Tuition;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/tuition")]
[Authorize(Policy = "TeacherOrAdmin")]
public class TuitionController(ITuitionService tuitionService) : ControllerBase
{
    /// <summary>Admin/Teacher: tất cả hóa đơn học phí.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<TuitionInvoiceDto>>> GetInvoices(
        [FromQuery] PagedRequest request,
        [FromQuery] Guid? studentId,
        CancellationToken ct) =>
        (await tuitionService.GetPagedAsync(request, studentId, ct)).ToActionResult();

    [HttpGet("students")]
    public async Task<ActionResult<PagedResult<TuitionStudentListItemDto>>> GetStudents(
        [FromQuery] PagedRequest request,
        [FromQuery] int periodYear,
        [FromQuery] int periodMonth,
        [FromQuery] DateOnly? dueDate = null,
        [FromQuery] Guid? branchId = null,
        [FromQuery] Guid? subjectId = null,
        [FromQuery] Guid? gradeId = null,
        [FromQuery] Guid? teacherProfileId = null,
        CancellationToken ct = default) =>
        (await tuitionService.GetStudentsAsync(request, periodYear, periodMonth, dueDate, branchId, subjectId, gradeId, teacherProfileId, ct)).ToActionResult();

    [HttpGet("students/{studentId:guid}/bill")]
    public async Task<ActionResult<TuitionBillDto>> GetBill(
        Guid studentId,
        [FromQuery] int periodYear,
        [FromQuery] int periodMonth,
        [FromQuery] DateOnly? dueDate,
        CancellationToken ct) =>
        (await tuitionService.GetStudentBillAsync(studentId, periodYear, periodMonth, dueDate, ct)).ToActionResult();

    [HttpPost("students/{studentId:guid}/pay")]
    public async Task<ActionResult<TuitionBillDto>> PayStudent(Guid studentId, PayStudentTuitionRequest request, CancellationToken ct) =>
        (await tuitionService.PayStudentAsync(studentId, request, ct)).ToActionResult();

    [HttpGet("students/{studentId:guid}")]
    public async Task<ActionResult<List<TuitionInvoiceDto>>> GetByStudent(Guid studentId, CancellationToken ct) =>
        (await tuitionService.GetByStudentAsync(studentId, ct)).ToActionResult();

    [HttpPost]
    public async Task<ActionResult<TuitionInvoiceDto>> Create(CreateTuitionInvoiceRequest request, CancellationToken ct) =>
        (await tuitionService.CreateAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TuitionInvoiceDto>> Update(Guid id, UpdateTuitionInvoiceRequest request, CancellationToken ct) =>
        (await tuitionService.UpdateAsync(id, request, ct)).ToActionResult();

    [HttpPost("{id:guid}/mark-paid")]
    public async Task<ActionResult<TuitionInvoiceDto>> MarkPaid(Guid id, MarkPaidRequest request, CancellationToken ct) =>
        (await tuitionService.MarkPaidAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await tuitionService.DeleteAsync(id, ct)).ToActionResult();

    [HttpPost("{id:guid}/restore")]
    public async Task<ActionResult> Restore(Guid id, CancellationToken ct) =>
        (await tuitionService.RestoreAsync(id, ct)).ToActionResult();
}
