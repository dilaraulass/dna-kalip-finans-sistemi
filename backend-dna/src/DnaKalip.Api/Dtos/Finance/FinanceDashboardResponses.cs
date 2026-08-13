namespace DnaKalip.Api.Dtos.Finance;

public sealed record FinanceDashboardResponse(
    IReadOnlyCollection<FinancePaymentMilestoneResponse> PaymentMilestones,
    IReadOnlyCollection<FinanceExpenseInvoiceResponse> ExpenseInvoices,
    IReadOnlyDictionary<string, decimal> ExchangeRates);

public sealed record ExchangeRateResponse(
    string Currency,
    decimal RateToTry,
    DateOnly EffectiveDate,
    DateTimeOffset CreatedAt);

public sealed record FinancePaymentMilestoneResponse(
    Guid Id,
    Guid ContractId,
    string TrackingKey,
    string ContractNumber,
    string FinanceTab,
    string Company,
    string WorkOrder,
    string ReferenceNumber,
    DateOnly? ContractDate,
    decimal ContractAmount,
    string ContractCurrency,
    string Currency,
    string? ExchangeRateType,
    decimal? FixedExchangeRate,
    decimal? MilestoneRate,
    string MilestoneCondition,
    string SubMilestone,
    decimal Amount,
    int DefaultDueDays,
    int ActiveDueDays,
    DateOnly? ApprovalDate,
    DateOnly? PaymentDate,
    string PaymentStatus,
    string StatusKey,
    string Status,
    int? DaysUntilDue,
    int MilestoneIndex);

public sealed record FinanceExpenseInvoiceResponse(
    Guid Id,
    string WorkOrder,
    string InvoiceType,
    string Company,
    decimal Amount,
    string Currency,
    DateOnly InvoiceDate,
    int DueDays,
    DateOnly? PaymentDate,
    DateOnly ExpectedPaymentDate,
    int? PaymentDateDifference,
    string PaymentStatus,
    string StatusKey,
    string Status,
    int? DaysUntilDue);
