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
    decimal DiscountAmount,
    decimal PaidAmount,
    DateOnly DueDate,
    TuitionStatus Status,
    DateOnly? PaidOn,
    string? Note,
    bool IsDeleted,
    DateTime CreatedAt);

public sealed record TuitionStudentListItemDto(
    Guid StudentId,
    string StudentCode,
    string StudentName,
    string? Phone,
    string? ParentPhone,
    int PeriodYear,
    int PeriodMonth,
    DateOnly DueDate,
    decimal TotalAmount,
    decimal DiscountAmount,
    decimal PaidAmount,
    decimal RemainingAmount,
    TuitionStatus Status);

public sealed record TuitionClassLineDto(
    Guid ClassId,
    string ClassCode,
    string ClassName,
    string? TeacherName,
    string? SubjectName,
    string? GradeName,
    string? BranchName,
    decimal TuitionFee);

public sealed record TuitionBillDto(
    Guid StudentId,
    string StudentCode,
    string StudentName,
    string? Phone,
    string? ParentPhone,
    int PeriodYear,
    int PeriodMonth,
    DateOnly DueDate,
    IReadOnlyList<TuitionClassLineDto> Classes,
    decimal TotalAmount,
    decimal DiscountAmount,
    decimal PaidAmount,
    decimal RemainingAmount,
    TuitionStatus Status,
    IReadOnlyList<TuitionInvoiceDto> Invoices);

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

public sealed record PayStudentTuitionRequest(
    int PeriodYear,
    int PeriodMonth,
    DateOnly DueDate,
    decimal DiscountAmount,
    decimal PaidAmount,
    string? Note);
