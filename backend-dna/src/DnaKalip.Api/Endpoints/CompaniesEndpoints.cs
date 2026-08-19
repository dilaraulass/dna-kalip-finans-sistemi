using DnaKalip.Api.Data;
using DnaKalip.Api.Domain;
using DnaKalip.Api.Dtos.Companies;
using DnaKalip.Api.Entities;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace DnaKalip.Api.Endpoints;

public static class CompaniesEndpoints
{
    public static IEndpointRouteBuilder MapCompaniesEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/companies")
            .RequireAuthorization(AuthPolicies.AuthenticatedUser)
            .WithTags("Companies");

        group.MapGet(string.Empty, async (
            string? companyType,
            string? search,
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var normalizedCompanyType = NormalizeOptional(companyType)?.ToLowerInvariant();

            if (normalizedCompanyType is not null &&
                normalizedCompanyType is not ("all" or FinanceTabs.Customer or FinanceTabs.Supplier))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["companyType"] = ["companyType all, musteri veya tedarikci olmalıdır."],
                });
            }

            var query = db.Companies.AsNoTracking();

            if (normalizedCompanyType is FinanceTabs.Customer or FinanceTabs.Supplier)
            {
                query = query.Where(company => company.CompanyType == normalizedCompanyType);
            }

            var searchText = NormalizeOptional(search);

            if (searchText is not null)
            {
                query = query.Where(company =>
                    company.Name.Contains(searchText) ||
                    (company.TaxNumber != null && company.TaxNumber.Contains(searchText)) ||
                    (company.Email != null && company.Email.Contains(searchText)) ||
                    (company.Phone != null && company.Phone.Contains(searchText)));
            }

            var companies = await query
                .OrderBy(company => company.Name)
                .Select(company => new CompanyListItemResponse(
                    company.Id,
                    company.Name,
                    company.CompanyType,
                    company.TaxNumber,
                    company.Email,
                    company.Phone,
                    company.CreatedAt,
                    company.Contracts.Count,
                    company.Contracts.Count(contract => !contract.IsArchived),
                    company.Contracts.Count(contract => contract.IsArchived)))
                .ToListAsync(cancellationToken);

            return Results.Ok(companies);
        })
        .WithName("GetCompanies");

        group.MapGet("/{id:guid}", async (
            Guid id,
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var company = await GetCompanyDetailAsync(db, id, cancellationToken);

            return company is null
                ? Results.NotFound()
                : Results.Ok(company);
        })
        .WithName("GetCompanyById");

        group.MapPost(string.Empty, async (
            CreateCompanyRequest request,
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var validationErrors = ValidateCompanyRequest(
                request.Name,
                request.CompanyType,
                request.Email,
                request.Phone);

            if (validationErrors.Count > 0)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var name = request.Name.Trim();
            var companyType = NormalizeCompanyType(request.CompanyType);

            var companyExists = await db.Companies
                .AnyAsync(company => company.Name == name, cancellationToken);

            if (companyExists)
            {
                return Results.Conflict(new
                {
                    message = "Bu firma adıyla kayıt zaten var.",
                });
            }

            var company = new Company
            {
                Name = name,
                CompanyType = companyType,
                TaxNumber = NormalizeOptional(request.TaxNumber),
                Email = NormalizeOptional(request.Email),
                Phone = NormalizeOptional(request.Phone),
            };

            db.Companies.Add(company);
            await db.SaveChangesAsync(cancellationToken);

            var createdCompany = await GetCompanyDetailAsync(
                db,
                company.Id,
                cancellationToken);

            return Results.Created($"/api/companies/{company.Id}", createdCompany);
        })
        .WithName("CreateCompany");

        group.MapPut("/{id:guid}", async (
            Guid id,
            UpdateCompanyRequest request,
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var validationErrors = ValidateCompanyRequest(
                request.Name,
                request.CompanyType,
                request.Email,
                request.Phone);

            if (validationErrors.Count > 0)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var company = await db.Companies
                .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

            if (company is null)
            {
                return Results.NotFound();
            }

            var name = request.Name.Trim();
            var companyNameExists = await db.Companies
                .AnyAsync(
                    item => item.Id != id && item.Name == name,
                    cancellationToken);

            if (companyNameExists)
            {
                return Results.Conflict(new
                {
                    message = "Bu firma adıyla başka bir kayıt zaten var.",
                });
            }

            company.Name = name;
            company.CompanyType = NormalizeCompanyType(request.CompanyType);
            company.TaxNumber = NormalizeOptional(request.TaxNumber);
            company.Email = NormalizeOptional(request.Email);
            company.Phone = NormalizeOptional(request.Phone);

            await db.SaveChangesAsync(cancellationToken);

            var updatedCompany = await GetCompanyDetailAsync(
                db,
                company.Id,
                cancellationToken);

            return Results.Ok(updatedCompany);
        })
        .WithName("UpdateCompany");

        return app;
    }

    private static async Task<CompanyDetailResponse?> GetCompanyDetailAsync(
        DnaKalipDbContext db,
        Guid id,
        CancellationToken cancellationToken)
    {
        return await db.Companies
            .AsNoTracking()
            .Where(company => company.Id == id)
            .Select(company => new CompanyDetailResponse(
                company.Id,
                company.Name,
                company.CompanyType,
                company.TaxNumber,
                company.Email,
                company.Phone,
                company.CreatedAt,
                company.Contracts
                    .OrderByDescending(contract => contract.ContractDate)
                    .ThenBy(contract => contract.ContractNumber)
                    .Select(contract => new CompanyContractSummaryResponse(
                        contract.Id,
                        contract.ContractNumber,
                        contract.FinanceTab,
                        contract.ContractDate,
                        contract.TotalAmount,
                        contract.Currency,
                        contract.IsArchived))
                    .ToList()))
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static Dictionary<string, string[]> ValidateCompanyRequest(
        string? name,
        string? companyType,
        string? email,
        string? phone)
    {
        var errors = new Dictionary<string, string[]>();
        var normalizedCompanyType = NormalizeCompanyType(companyType);
        var normalizedEmail = NormalizeOptional(email);
        var normalizedPhone = NormalizeOptional(phone);

        AddErrorIf(
            errors,
            string.IsNullOrWhiteSpace(name),
            "name",
            "Firma adı zorunludur.");

        AddErrorIf(
            errors,
            normalizedCompanyType is not null &&
                normalizedCompanyType is not (FinanceTabs.Customer or FinanceTabs.Supplier),
            "companyType",
            "Firma türü musteri veya tedarikci olmalıdır.");

        AddErrorIf(
            errors,
            normalizedEmail is not null && !IsValidEmail(normalizedEmail),
            "email",
            "E-posta formatı geçerli olmalıdır.");

        AddErrorIf(
            errors,
            normalizedPhone is not null && !IsValidPhone(normalizedPhone),
            "phone",
            "Telefon yalnızca rakam, boşluk, +, -, ( ve ) karakterlerini içerebilir.");

        return errors;
    }

    private static void AddErrorIf(
        Dictionary<string, string[]> errors,
        bool condition,
        string field,
        string message)
    {
        if (condition)
        {
            errors[field] = [message];
        }
    }

    private static string? NormalizeCompanyType(string? value)
    {
        return NormalizeOptional(value)?.ToLowerInvariant();
    }

    private static bool IsValidEmail(string value)
    {
        return Regex.IsMatch(
            value,
            @"^[^@\s]+@[^@\s]+\.[^@\s]+$",
            RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));
    }

    private static bool IsValidPhone(string value)
    {
        return Regex.IsMatch(
            value,
            @"^[0-9\s+\-()]+$",
            RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
