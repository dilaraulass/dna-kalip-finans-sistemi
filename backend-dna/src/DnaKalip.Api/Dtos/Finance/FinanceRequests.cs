namespace DnaKalip.Api.Dtos.Finance;

public sealed record UpdatePaymentTrackingRequest(
    DateOnly? ApprovalDate,
    DateOnly? PaymentDate,
    string Status,
    int? DueDaysOverride,
    bool InvoiceIssued,
    string? InvoiceNumber);

public sealed record UpsertExchangeRateRequest(
    decimal RateToTry,
    DateOnly? EffectiveDate);

public sealed record CreateExpenseInvoiceRequest(
    Guid? CompanyId,
    string? WorkOrderNumber,
    string? InvoiceType,
    string Description,
    decimal Amount,
    string Currency,
    DateOnly InvoiceDate,
    int DueDays,
    DateOnly? PaymentDate,
    string Status,
    bool InvoiceIssued,
    string? InvoiceNumber);

public sealed record UpdateExpenseInvoiceRequest(
    Guid? CompanyId,
    string? WorkOrderNumber,
    string? InvoiceType,
    string Description,
    decimal Amount,
    string Currency,
    DateOnly InvoiceDate,
    int DueDays,
    DateOnly? PaymentDate,
    string Status,
    bool InvoiceIssued,
    string? InvoiceNumber);
