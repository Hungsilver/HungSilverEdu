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
    /// <summary>Admin: tất cả; Teacher: học phí của học sinh trong lớp mình.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<TuitionInvoiceDto>>> GetInvoices(
        [FromQuery] PagedRequest request,
        [FromQuery] Guid? studentId,
        CancellationToken ct) =>
        (await tuitionService.GetPagedAsync(request, studentId, ct)).ToActionResult();

    [HttpGet("students/{studentId:guid}")]
    public async Task<ActionResult<List<TuitionInvoiceDto>>> GetByStudent(Guid studentId, CancellationToken ct) =>
        (await tuitionService.GetByStudentAsync(studentId, ct)).ToActionResult();

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<TuitionInvoiceDto>> Create(CreateTuitionInvoiceRequest request, CancellationToken ct) =>
        (await tuitionService.CreateAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<TuitionInvoiceDto>> Update(Guid id, UpdateTuitionInvoiceRequest request, CancellationToken ct) =>
        (await tuitionService.UpdateAsync(id, request, ct)).ToActionResult();

    [HttpPost("{id:guid}/mark-paid")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<TuitionInvoiceDto>> MarkPaid(Guid id, MarkPaidRequest request, CancellationToken ct) =>
        (await tuitionService.MarkPaidAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await tuitionService.DeleteAsync(id, ct)).ToActionResult();

    [HttpPost("{id:guid}/restore")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Restore(Guid id, CancellationToken ct) =>
        (await tuitionService.RestoreAsync(id, ct)).ToActionResult();
}
