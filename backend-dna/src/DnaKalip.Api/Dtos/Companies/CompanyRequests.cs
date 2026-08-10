namespace DnaKalip.Api.Dtos.Companies;

public sealed record CreateCompanyRequest(
    string Name,
    string? CompanyType,
    string? TaxNumber,
    string? Email,
    string? Phone);

public sealed record UpdateCompanyRequest(
    string Name,
    string? CompanyType,
    string? TaxNumber,
    string? Email,
    string? Phone);
