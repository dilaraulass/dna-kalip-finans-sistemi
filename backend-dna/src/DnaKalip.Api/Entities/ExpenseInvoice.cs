namespace DnaKalip.Api.Entities;

public class ExpenseInvoice
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string? WorkOrderNumber { get; set; }
    public string? InvoiceType { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "TRY";
    public DateOnly InvoiceDate { get; set; }
    public int DueDays { get; set; }
    public DateOnly? PaymentDate { get; set; }
    public string Status { get; set; } = "pending";
    public bool IsArchived { get; set; }
    public DateTimeOffset? ArchivedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
