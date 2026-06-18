using FluentValidation;
using HungSilver.Application.Common;
using HungSilver.Application.Common.Models;
using HungSilver.Application.Settings;
using HungSilver.Application.Tuition;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Tuition;

public sealed class TuitionService(
    AppDbContext context,
    IClassAccessGuard accessGuard,
    ISettingsResolver settings,
    IValidator<CreateTuitionInvoiceRequest> createValidator,
    IValidator<UpdateTuitionInvoiceRequest> updateValidator) : ITuitionService
{
    private static readonly Error NotFoundError = Error.NotFound("Tuition.NotFound", "Không tìm thấy hóa đơn học phí.");

    public async Task<Result<PagedResult<TuitionInvoiceDto>>> GetPagedAsync(PagedRequest request, Guid? studentId = null, CancellationToken ct = default)
    {
        var query = context.TuitionInvoices.AsNoTracking().AsQueryable();

        if (!accessGuard.IsAdmin)
        {
            var allowed = await TeacherStudentIdsAsync(ct);
            query = query.Where(t => allowed.Contains(t.StudentId));
        }

        if (studentId is not null)
            query = query.Where(t => t.StudentId == studentId);

        var total = await query.CountAsync(ct);
        var page = Math.Max(request.Page, 1);
        var items = await query
            .OrderByDescending(t => t.DueDate)
            .Skip((page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(ct);

        var dtos = await ToDtosAsync(items, ct);
        return new PagedResult<TuitionInvoiceDto>
        {
            Items = dtos,
            Page = page,
            PageSize = request.PageSize,
            TotalCount = total
        };
    }

    public async Task<Result<List<TuitionInvoiceDto>>> GetByStudentAsync(Guid studentId, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessStudentAsync(studentId, ct);
        if (access.IsFailure)
            return Result.Failure<List<TuitionInvoiceDto>>(access.Error);

        var items = await context.TuitionInvoices.AsNoTracking()
            .Where(t => t.StudentId == studentId)
            .OrderByDescending(t => t.DueDate)
            .ToListAsync(ct);

        return await ToDtosAsync(items, ct);
    }

    public async Task<Result<TuitionInvoiceDto>> CreateAsync(CreateTuitionInvoiceRequest request, CancellationToken ct = default)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<TuitionInvoiceDto>(validation.ToError("Tuition.Validation"));

        if (!await context.Students.AnyAsync(s => s.Id == request.StudentId, ct))
            return Result.Failure<TuitionInvoiceDto>(Error.NotFound("Student.NotFound", "Không tìm thấy học sinh."));

        var invoice = new TuitionInvoice
        {
            StudentId = request.StudentId,
            ClassId = request.ClassId,
            PeriodYear = request.PeriodYear,
            PeriodMonth = request.PeriodMonth,
            Amount = request.Amount,
            DueDate = request.DueDate,
            Status = TuitionStatus.Pending,
            Note = request.Note?.Trim()
        };
        context.TuitionInvoices.Add(invoice);
        await context.SaveChangesAsync(ct);

        return (await ToDtosAsync([invoice], ct))[0];
    }

    public async Task<Result<TuitionInvoiceDto>> UpdateAsync(Guid id, UpdateTuitionInvoiceRequest request, CancellationToken ct = default)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<TuitionInvoiceDto>(validation.ToError("Tuition.Validation"));

        var invoice = await context.TuitionInvoices.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (invoice is null)
            return Result.Failure<TuitionInvoiceDto>(NotFoundError);

        invoice.Amount = request.Amount;
        invoice.DueDate = request.DueDate;
        invoice.Note = request.Note?.Trim();
        await context.SaveChangesAsync(ct);

        return (await ToDtosAsync([invoice], ct))[0];
    }

    public async Task<Result<TuitionInvoiceDto>> MarkPaidAsync(Guid id, MarkPaidRequest request, CancellationToken ct = default)
    {
        var invoice = await context.TuitionInvoices.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (invoice is null)
            return Result.Failure<TuitionInvoiceDto>(NotFoundError);

        invoice.PaidOn = request.PaidOn ?? await TodayAsync(ct);
        invoice.Status = TuitionStatus.Paid;
        await context.SaveChangesAsync(ct);

        return (await ToDtosAsync([invoice], ct))[0];
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var invoice = await context.TuitionInvoices.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (invoice is null)
            return Result.Failure(NotFoundError);

        context.TuitionInvoices.Remove(invoice);
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result> RestoreAsync(Guid id, CancellationToken ct = default)
    {
        var invoice = await context.TuitionInvoices.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == id && t.IsDeleted, ct);
        if (invoice is null)
            return Result.Failure(NotFoundError);

        invoice.IsDeleted = false;
        invoice.DeletedAt = null;
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    private async Task<List<TuitionInvoiceDto>> ToDtosAsync(List<TuitionInvoice> items, CancellationToken ct)
    {
        if (items.Count == 0)
            return [];

        var today = await TodayAsync(ct);
        var dueSoonDays = await GetDueSoonDaysAsync(ct);

        var studentIds = items.Select(i => i.StudentId).Distinct().ToList();
        var names = await context.Students.AsNoTracking()
            .Where(s => studentIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.FullName, ct);

        return items.Select(i => new TuitionInvoiceDto(
            i.Id, i.StudentId, names.GetValueOrDefault(i.StudentId, string.Empty), i.ClassId,
            i.PeriodYear, i.PeriodMonth, i.Amount, i.DueDate,
            EffectiveStatus(i, today, dueSoonDays), i.PaidOn, i.Note, i.IsDeleted, i.CreatedAt)).ToList();
    }

    private static TuitionStatus EffectiveStatus(TuitionInvoice i, DateOnly today, int dueSoonDays)
    {
        if (i.PaidOn is not null)
            return TuitionStatus.Paid;
        if (i.DueDate < today)
            return TuitionStatus.Overdue;
        if (i.DueDate <= today.AddDays(dueSoonDays))
            return TuitionStatus.DueSoon;
        return TuitionStatus.Pending;
    }

    private async Task<List<Guid>> TeacherStudentIdsAsync(CancellationToken ct)
    {
        var classIds = await context.Classes.AsNoTracking()
            .Where(c => c.TeacherId == accessGuard.TeacherScopeId)
            .Select(c => c.Id).ToListAsync(ct);
        return await context.Enrollments.AsNoTracking()
            .Where(e => classIds.Contains(e.ClassId) && e.IsActive)
            .Select(e => e.StudentId).Distinct().ToListAsync(ct);
    }

    private async Task<int> GetDueSoonDaysAsync(CancellationToken ct)
    {
        var v = await settings.GetEffectiveValueAsync(SettingKeys.TuitionDueSoonDays, ct: ct);
        return int.TryParse(v, out var n) ? n : 7;
    }

    private Task<DateOnly> TodayAsync(CancellationToken ct) =>
        Task.FromResult(DateOnly.FromDateTime(DateTime.Now));
}
