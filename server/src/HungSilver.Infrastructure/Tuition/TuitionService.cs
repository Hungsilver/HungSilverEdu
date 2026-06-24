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
    ICurrentRelationCleanupService relationCleanup,
    ISettingsResolver settings,
    IValidator<CreateTuitionInvoiceRequest> createValidator,
    IValidator<UpdateTuitionInvoiceRequest> updateValidator) : ITuitionService
{
    private static readonly Error NotFoundError = Error.NotFound("Tuition.NotFound", "Không tìm thấy hóa đơn học phí.");

    public async Task<Result<PagedResult<TuitionInvoiceDto>>> GetPagedAsync(PagedRequest request, Guid? studentId = null, CancellationToken ct = default)
    {
        var query = context.TuitionInvoices.AsNoTracking().AsQueryable();
        var scopeStudentIds = await TeacherStudentIdsAsync(ct);
        if (scopeStudentIds is not null)
            query = query.Where(t => scopeStudentIds.Contains(t.StudentId));
        if (studentId is not null)
            query = query.Where(t => t.StudentId == studentId);

        var total = await query.CountAsync(ct);
        var page = Math.Max(request.Page, 1);
        var items = await query.OrderByDescending(t => t.DueDate)
            .Skip((page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(ct);

        return new PagedResult<TuitionInvoiceDto>
        {
            Items = await ToDtosAsync(items, ct),
            Page = page,
            PageSize = request.PageSize,
            TotalCount = total
        };
    }

    public async Task<Result<PagedResult<TuitionStudentListItemDto>>> GetStudentsAsync(
        PagedRequest request,
        int periodYear,
        int periodMonth,
        DateOnly? dueDate = null,
        Guid? branchId = null,
        Guid? subjectId = null,
        Guid? gradeId = null,
        Guid? teacherProfileId = null,
        CancellationToken ct = default)
    {
        var studentIds = await FilterStudentIdsAsync(branchId, subjectId, gradeId, teacherProfileId, ct);
        var query = context.Students.AsNoTracking().AsQueryable();
        if (studentIds is not null)
            query = query.Where(s => studentIds.Contains(s.Id));
        var scopeAllowed = await TeacherStudentIdsAsync(ct);
        if (scopeAllowed is not null)
            query = query.Where(s => scopeAllowed.Contains(s.Id));
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLower();
            query = query.Where(s => s.StudentCode.ToLower().Contains(term)
                                     || s.FullName.ToLower().Contains(term)
                                     || (s.Phone != null && s.Phone.Contains(term))
                                     || (s.ParentPhone != null && s.ParentPhone.Contains(term)));
        }

        var total = await query.CountAsync(ct);
        var page = Math.Max(request.Page, 1);
        var students = await query.OrderByDescending(s => s.CreatedAt)
            .Skip((page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(ct);

        var items = new List<TuitionStudentListItemDto>();
        foreach (var student in students)
        {
            var bill = await BuildBillAsync(student, periodYear, periodMonth, dueDate, ct);
            items.Add(new TuitionStudentListItemDto(
                student.Id, student.StudentCode, student.FullName, student.Phone, student.ParentPhone,
                periodYear, periodMonth, bill.DueDate, bill.TotalAmount, bill.DiscountAmount,
                bill.PaidAmount, bill.RemainingAmount, bill.Status));
        }

        return new PagedResult<TuitionStudentListItemDto>
        {
            Items = items,
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

    public async Task<Result<TuitionBillDto>> GetStudentBillAsync(Guid studentId, int periodYear, int periodMonth, DateOnly? dueDate = null, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessStudentAsync(studentId, ct);
        if (access.IsFailure)
            return Result.Failure<TuitionBillDto>(access.Error);

        var student = await context.Students.AsNoTracking().FirstOrDefaultAsync(s => s.Id == studentId, ct);
        if (student is null)
            return Result.Failure<TuitionBillDto>(Error.NotFound("Student.NotFound", "Không tìm thấy học sinh."));

        return await BuildBillAsync(student, periodYear, periodMonth, dueDate, ct);
    }

    public async Task<Result<TuitionBillDto>> PayStudentAsync(Guid studentId, PayStudentTuitionRequest request, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessStudentAsync(studentId, ct);
        if (access.IsFailure)
            return Result.Failure<TuitionBillDto>(access.Error);

        if (request.DiscountAmount < 0 || request.PaidAmount < 0)
            return Result.Failure<TuitionBillDto>(Error.Validation("Tuition.InvalidAmount", "Số tiền giảm/đã đóng không hợp lệ."));

        var student = await context.Students.FirstOrDefaultAsync(s => s.Id == studentId, ct);
        if (student is null)
            return Result.Failure<TuitionBillDto>(Error.NotFound("Student.NotFound", "Không tìm thấy học sinh."));

        var lines = await LoadTuitionLinesAsync(studentId, ct);
        if (lines.Count == 0)
            return Result.Failure<TuitionBillDto>(Error.Validation("Tuition.NoClass", "Học viên chưa có lớp đang học."));

        var total = lines.Sum(x => x.TuitionFee);
        var net = Math.Max(0, total - request.DiscountAmount);
        var paid = Math.Min(request.PaidAmount, net);
        var status = paid >= net ? TuitionStatus.Paid : paid > 0 ? TuitionStatus.Partial : EffectiveStatus(null, request.DueDate, await GetDueSoonDaysAsync(ct));

        var oldInvoices = await context.TuitionInvoices
            .Where(t => t.StudentId == studentId && t.PeriodYear == request.PeriodYear && t.PeriodMonth == request.PeriodMonth)
            .ToListAsync(ct);
        foreach (var invoice in oldInvoices)
            context.TuitionInvoices.Remove(invoice);

        foreach (var line in lines)
        {
            var ratio = total > 0 ? line.TuitionFee / total : 0;
            context.TuitionInvoices.Add(new TuitionInvoice
            {
                StudentId = studentId,
                ClassId = line.ClassId,
                PeriodYear = request.PeriodYear,
                PeriodMonth = request.PeriodMonth,
                Amount = line.TuitionFee,
                DiscountAmount = Math.Round(request.DiscountAmount * ratio, 2),
                PaidAmount = Math.Round(paid * ratio, 2),
                DueDate = request.DueDate,
                Status = status,
                PaidOn = paid > 0 ? DateOnly.FromDateTime(DateTime.Now) : null,
                Note = request.Note?.Trim()
            });
        }

        await context.SaveChangesAsync(ct);
        return await BuildBillAsync(student, request.PeriodYear, request.PeriodMonth, request.DueDate, ct);
    }

    public async Task<Result<TuitionInvoiceDto>> CreateAsync(CreateTuitionInvoiceRequest request, CancellationToken ct = default)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<TuitionInvoiceDto>(validation.ToError("Tuition.Validation"));

        var access = await accessGuard.EnsureCanAccessStudentAsync(request.StudentId, ct);
        if (access.IsFailure)
            return Result.Failure<TuitionInvoiceDto>(access.Error);

        if (!await context.Students.AnyAsync(s => s.Id == request.StudentId, ct))
            return Result.Failure<TuitionInvoiceDto>(Error.NotFound("Student.NotFound", "Không tìm thấy học sinh."));
        if (request.ClassId is not null && !await context.Classes.AnyAsync(c => c.Id == request.ClassId.Value, ct))
            return Result.Failure<TuitionInvoiceDto>(Error.NotFound("Class.NotFound", "Không tìm thấy lớp học."));

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

        var access = await accessGuard.EnsureCanAccessStudentAsync(invoice.StudentId, ct);
        if (access.IsFailure)
            return Result.Failure<TuitionInvoiceDto>(access.Error);

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

        var access = await accessGuard.EnsureCanAccessStudentAsync(invoice.StudentId, ct);
        if (access.IsFailure)
            return Result.Failure<TuitionInvoiceDto>(access.Error);

        invoice.PaidOn = request.PaidOn ?? DateOnly.FromDateTime(DateTime.Now);
        invoice.PaidAmount = Math.Max(0, invoice.Amount - invoice.DiscountAmount);
        invoice.Status = TuitionStatus.Paid;
        await context.SaveChangesAsync(ct);
        return (await ToDtosAsync([invoice], ct))[0];
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var invoice = await context.TuitionInvoices.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (invoice is null)
            return Result.Failure(NotFoundError);

        var access = await accessGuard.EnsureCanAccessStudentAsync(invoice.StudentId, ct);
        if (access.IsFailure)
            return access;

        context.TuitionInvoices.Remove(invoice);
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result> RestoreAsync(Guid id, CancellationToken ct = default)
    {
        var invoice = await context.TuitionInvoices.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == id && t.IsDeleted, ct);
        if (invoice is null)
            return Result.Failure(NotFoundError);

        var access = await accessGuard.EnsureCanAccessStudentAsync(invoice.StudentId, ct);
        if (access.IsFailure)
            return access;

        invoice.IsDeleted = false;
        invoice.DeletedAt = null;
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    private async Task<TuitionBillDto> BuildBillAsync(Student student, int periodYear, int periodMonth, DateOnly? dueDate, CancellationToken ct)
    {
        var lines = await LoadTuitionLinesAsync(student.Id, ct);
        var invoices = await context.TuitionInvoices.AsNoTracking()
            .Where(t => t.StudentId == student.Id && t.PeriodYear == periodYear && t.PeriodMonth == periodMonth)
            .ToListAsync(ct);

        var total = lines.Sum(x => x.TuitionFee);
        var discount = invoices.Sum(x => x.DiscountAmount);
        var paid = invoices.Sum(x => x.PaidAmount);
        var remaining = Math.Max(0, total - discount - paid);
        var billDueDate = invoices.FirstOrDefault()?.DueDate ?? dueDate ?? DateOnly.FromDateTime(DateTime.Now);
        var status = remaining <= 0 && total > 0
            ? TuitionStatus.Paid
            : paid > 0
                ? TuitionStatus.Partial
                : EffectiveStatus(null, billDueDate, await GetDueSoonDaysAsync(ct));

        return new TuitionBillDto(
            student.Id, student.StudentCode, student.FullName, student.Phone, student.ParentPhone,
            periodYear, periodMonth, billDueDate, lines, total, discount, paid, remaining, status,
            await ToDtosAsync(invoices, ct));
    }

    private async Task<List<TuitionClassLineDto>> LoadTuitionLinesAsync(Guid studentId, CancellationToken ct)
    {
        return await (
            from e in context.Enrollments.AsNoTracking()
            join c in context.Classes.AsNoTracking() on e.ClassId equals c.Id
            where e.StudentId == studentId && e.IsActive
            orderby c.Name
            select new TuitionClassLineDto(
                c.Id, c.ClassCode, c.Name, c.TeacherName, c.SubjectName, c.GradeName, c.BranchName, c.TuitionFee))
            .ToListAsync(ct);
    }

    private async Task<List<TuitionInvoiceDto>> ToDtosAsync(List<TuitionInvoice> items, CancellationToken ct)
    {
        if (items.Count == 0)
            return [];
        var today = DateOnly.FromDateTime(DateTime.Now);
        var dueSoonDays = await GetDueSoonDaysAsync(ct);
        var studentIds = items.Select(i => i.StudentId).Distinct().ToList();
        var students = await context.Students.AsNoTracking()
            .Where(s => studentIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => new { s.FullName, s.StudentCode }, ct);

        return items.Select(i =>
        {
            var s = students.GetValueOrDefault(i.StudentId);
            return new TuitionInvoiceDto(
                i.Id, i.StudentId, s?.StudentCode ?? string.Empty, s?.FullName ?? string.Empty, i.ClassId,
                i.PeriodYear, i.PeriodMonth, i.Amount, i.DiscountAmount, i.PaidAmount, i.DueDate,
                EffectiveStatus(i, today, dueSoonDays), i.PaidOn, i.Note, i.IsDeleted, i.CreatedAt);
        }).ToList();
    }

    private static TuitionStatus EffectiveStatus(TuitionInvoice? invoice, DateOnly todayOrDueDate, int dueSoonDays)
    {
        if (invoice is not null)
        {
            var net = Math.Max(0, invoice.Amount - invoice.DiscountAmount);
            if (invoice.PaidAmount >= net && net > 0)
                return TuitionStatus.Paid;
            if (invoice.PaidAmount > 0)
                return TuitionStatus.Partial;
            if (invoice.DueDate < todayOrDueDate)
                return TuitionStatus.Overdue;
            if (invoice.DueDate <= todayOrDueDate.AddDays(dueSoonDays))
                return TuitionStatus.DueSoon;
            return TuitionStatus.Pending;
        }

        var today = DateOnly.FromDateTime(DateTime.Now);
        if (todayOrDueDate < today)
            return TuitionStatus.Overdue;
        if (todayOrDueDate <= today.AddDays(dueSoonDays))
            return TuitionStatus.DueSoon;
        return TuitionStatus.Pending;
    }

    private async Task<HashSet<Guid>?> FilterStudentIdsAsync(Guid? branchId, Guid? subjectId, Guid? gradeId, Guid? teacherProfileId, CancellationToken ct)
    {
        if (branchId is null && subjectId is null && gradeId is null && teacherProfileId is null)
            return null;
        var classIds = await context.Classes.AsNoTracking()
            .Where(c => (branchId == null || c.BranchId == branchId)
                        && (subjectId == null || c.SubjectId == subjectId)
                        && (gradeId == null || c.GradeId == gradeId)
                        && (teacherProfileId == null || c.TeacherProfileId == teacherProfileId))
            .Select(c => c.Id)
            .ToListAsync(ct);
        return await relationCleanup.LoadValidActiveStudentIdsByClassesAsync(classIds, ct);
    }

    private async Task<List<Guid>?> TeacherStudentIdsAsync(CancellationToken ct)
    {
        var scopeId = await accessGuard.GetTeacherScopeIdAsync(ct);
        if (scopeId is null) return null;
        var classIds = await context.Classes.AsNoTracking()
            .Where(c => c.TeacherProfileId == scopeId)
            .Select(c => c.Id)
            .ToListAsync(ct);
        return (await relationCleanup.LoadValidActiveStudentIdsByClassesAsync(classIds, ct)).ToList();
    }

    private async Task<int> GetDueSoonDaysAsync(CancellationToken ct)
    {
        var v = await settings.GetEffectiveValueAsync(SettingKeys.TuitionDueSoonDays, ct: ct);
        return int.TryParse(v, out var n) ? n : 7;
    }
}
