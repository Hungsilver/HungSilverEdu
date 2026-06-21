using HungSilver.Application.Common.Models;
using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Tuition;

public interface ITuitionService
{
    Task<Result<PagedResult<TuitionInvoiceDto>>> GetPagedAsync(PagedRequest request, Guid? studentId = null, CancellationToken ct = default);
    Task<Result<PagedResult<TuitionStudentListItemDto>>> GetStudentsAsync(PagedRequest request, int periodYear, int periodMonth, DateOnly? dueDate = null, Guid? branchId = null, Guid? subjectId = null, Guid? gradeId = null, Guid? teacherProfileId = null, CancellationToken ct = default);
    Task<Result<List<TuitionInvoiceDto>>> GetByStudentAsync(Guid studentId, CancellationToken ct = default);
    Task<Result<TuitionBillDto>> GetStudentBillAsync(Guid studentId, int periodYear, int periodMonth, DateOnly? dueDate = null, CancellationToken ct = default);
    Task<Result<TuitionBillDto>> PayStudentAsync(Guid studentId, PayStudentTuitionRequest request, CancellationToken ct = default);
    Task<Result<TuitionInvoiceDto>> CreateAsync(CreateTuitionInvoiceRequest request, CancellationToken ct = default);
    Task<Result<TuitionInvoiceDto>> UpdateAsync(Guid id, UpdateTuitionInvoiceRequest request, CancellationToken ct = default);
    Task<Result<TuitionInvoiceDto>> MarkPaidAsync(Guid id, MarkPaidRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<Result> RestoreAsync(Guid id, CancellationToken ct = default);
}
