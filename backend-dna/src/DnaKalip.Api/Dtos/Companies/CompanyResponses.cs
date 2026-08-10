namespace DnaKalip.Api.Dtos.Companies;

public sealed record CompanyListItemResponse(
    Guid Id,
    string Name,
    string? CompanyType,
    string? TaxNumber,
    string? Email,
    string? Phone,
    DateTimeOffset CreatedAt,
    int ContractCount,
    int ActiveContractCount,
    int ArchivedContractCount);

public sealed record CompanyDetailResponse(
    Guid Id,
    string Name,
    string? CompanyType,
    string? TaxNumber,
    string? Email,
    string? Phone,
    DateTimeOffset CreatedAt,
    IReadOnlyCollection<CompanyContractSummaryResponse> Contracts);

public sealed record CompanyContractSummaryResponse(
    Guid Id,
    string ContractNumber,
    string FinanceTab,
    DateOnly? ContractDate,
    decimal TotalAmount,
    string Currency,
    bool IsArchived);
