namespace DnaKalip.Api.Dtos.Finance;

public sealed record UpdatePaymentTrackingRequest(
    DateOnly? ApprovalDate,
    DateOnly? PaymentDate,
    string Status,
    int? DueDaysOverride);

public sealed record CreateExpenseInvoiceRequest(
    string? WorkOrderNumber,
    string? InvoiceType,
    string Description,
    decimal Amount,
    string Currency,
    DateOnly InvoiceDate,
    int DueDays,
    DateOnly? PaymentDate,
    string Status);

public sealed record UpdateExpenseInvoiceRequest(
    string? WorkOrderNumber,
    string? InvoiceType,
    string Description,
    decimal Amount,
    string Currency,
    DateOnly InvoiceDate,
    int DueDays,
    DateOnly? PaymentDate,
    string Status);
