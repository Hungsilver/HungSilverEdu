using HungSilver.Domain.Common;
using HungSilver.Domain.Enums;

namespace HungSilver.Domain.Entities;

/// <summary>Hóa đơn/kỳ học phí của học sinh (Module 10).</summary>
public class TuitionInvoice : BaseEntity
{
    public Guid StudentId { get; set; }
    public Guid? ClassId { get; set; }
    public int PeriodYear { get; set; }
    public int PeriodMonth { get; set; }
    public decimal Amount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public DateOnly DueDate { get; set; }
    public TuitionStatus Status { get; set; } = TuitionStatus.Pending;
    public DateOnly? PaidOn { get; set; }
    public string? Note { get; set; }
}
