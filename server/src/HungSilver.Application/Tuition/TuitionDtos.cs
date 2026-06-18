using HungSilver.Domain.Enums;

namespace HungSilver.Application.Tuition;

public sealed record TuitionInvoiceDto(
    Guid Id,
    Guid StudentId,
    string StudentName,
    Guid? ClassId,
    int PeriodYear,
    int PeriodMonth,
    decimal Amount,
    DateOnly DueDate,
    TuitionStatus Status,
    DateOnly? PaidOn,
    string? Note,
    bool IsDeleted,
    DateTime CreatedAt);

public sealed record CreateTuitionInvoiceRequest(
    Guid StudentId,
    Guid? ClassId,
    int PeriodYear,
    int PeriodMonth,
    decimal Amount,
    DateOnly DueDate,
    string? Note);

public sealed record UpdateTuitionInvoiceRequest(decimal Amount, DateOnly DueDate, string? Note);

public sealed record MarkPaidRequest(DateOnly? PaidOn);
