namespace DnaKalip.Api.Dtos.Contracts;

public sealed record ContractListItemResponse(
    Guid Id,
    string ContractNumber,
    string FinanceTab,
    string? ContractType,
    int? ContractYear,
    string? ProjectNumber,
    DateOnly? ContractDate,
    string? CompanyName,
    string? CustomerProject,
    string? WorkOrderNumber,
    string? PartName,
    int MoldCount,
    decimal TotalAmount,
    string Currency,
    int MilestoneCount,
    int PaidMilestoneCount);

public sealed record ContractDetailResponse(
    Guid Id,
    string ContractNumber,
    string FinanceTab,
    string? ContractType,
    int? ContractYear,
    string? ContractNumberSuffix,
    string? ProjectNumber,
    DateOnly? ContractDate,
    CompanySummaryResponse? Company,
    string? CustomerProject,
    string? WorkOrderNumber,
    string? ReferenceNumber,
    string? PartName,
    int MoldCount,
    decimal TotalAmount,
    string Currency,
    string? ExchangeRateType,
    decimal? FixedExchangeRate,
    IReadOnlyCollection<ContractMilestoneResponse> Milestones);

public sealed record CompanySummaryResponse(
    Guid Id,
    string Name,
    string? CompanyType,
    string? TaxNumber,
    string? Email,
    string? Phone);

public sealed record ContractMilestoneResponse(
    Guid Id,
    string TrackingKey,
    int MilestoneIndex,
    int? SubMilestoneIndex,
    string? Condition,
    string? SubMilestoneName,
    decimal? Rate,
    decimal Amount,
    int DueDays,
    int SortOrder,
    PaymentTrackingResponse? PaymentTracking);

public sealed record PaymentTrackingResponse(
    Guid Id,
    DateOnly? ApprovalDate,
    DateOnly? PaymentDate,
    string Status,
    int? DueDaysOverride);
