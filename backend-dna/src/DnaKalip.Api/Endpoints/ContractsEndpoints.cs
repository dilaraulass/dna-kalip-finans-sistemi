using DnaKalip.Api.Data;
using DnaKalip.Api.Dtos.Contracts;
using DnaKalip.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace DnaKalip.Api.Endpoints;

public static class ContractsEndpoints
{
    public static IEndpointRouteBuilder MapContractsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/contracts")
            .WithTags("Contracts");

        group.MapGet(string.Empty, async (
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var contracts = await db.Contracts
                .AsNoTracking()
                .OrderByDescending(contract => contract.ContractDate)
                .ThenBy(contract => contract.ContractNumber)
                .Select(contract => new ContractListItemResponse(
                    contract.Id,
                    contract.ContractNumber,
                    contract.FinanceTab,
                    contract.ContractType,
                    contract.ContractYear,
                    contract.ProjectNumber,
                    contract.ContractDate,
                    contract.Company == null ? null : contract.Company.Name,
                    contract.CustomerProject,
                    contract.WorkOrderNumber,
                    contract.PartName,
                    contract.MoldCount,
                    contract.TotalAmount,
                    contract.Currency,
                    contract.Milestones.Count,
                    contract.Milestones.Count(milestone =>
                        milestone.PaymentTracking != null &&
                        milestone.PaymentTracking.Status == "paid")))
                .ToListAsync(cancellationToken);

            return Results.Ok(contracts);
        })
        .WithName("GetContracts");

        group.MapGet("/{id:guid}", async (
            Guid id,
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var contract = await GetContractDetailAsync(db, id, cancellationToken);

            return contract is null
                ? Results.NotFound()
                : Results.Ok(contract);
        })
        .WithName("GetContractById");

        group.MapPost(string.Empty, async (
            CreateContractRequest request,
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var validationErrors = ValidateCreateContractRequest(request);

            if (validationErrors.Count > 0)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var contractNumber = request.ContractNumber.Trim();
            var financeTab = request.FinanceTab.Trim().ToLowerInvariant();
            var currency = request.Currency.Trim().ToUpperInvariant();
            var companyName = request.CompanyName?.Trim();

            var contractExists = await db.Contracts
                .AnyAsync(
                    contract => contract.ContractNumber == contractNumber,
                    cancellationToken);

            if (contractExists)
            {
                return Results.Conflict(new
                {
                    message = "Bu sözleşme numarasıyla kayıt zaten var.",
                });
            }

            Company? company = null;

            if (request.CompanyId is not null)
            {
                company = await db.Companies
                    .FirstOrDefaultAsync(
                        item => item.Id == request.CompanyId,
                        cancellationToken);

                if (company is null)
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["companyId"] = ["Seçilen firma bulunamadı."],
                    });
                }
            }
            else if (!string.IsNullOrWhiteSpace(companyName))
            {
                company = await db.Companies
                    .FirstOrDefaultAsync(
                        item => item.Name == companyName,
                        cancellationToken);

                if (company is null)
                {
                    company = new Company
                    {
                        Name = companyName,
                        CompanyType = NormalizeOptional(request.CompanyType) ?? financeTab,
                        TaxNumber = NormalizeOptional(request.TaxNumber),
                        Email = NormalizeOptional(request.Email),
                        Phone = NormalizeOptional(request.Phone),
                    };

                    db.Companies.Add(company);
                }
            }

            var contract = new Contract
            {
                ContractNumber = contractNumber,
                FinanceTab = financeTab,
                ContractType = NormalizeOptional(request.ContractType),
                ContractYear = request.ContractYear,
                ContractNumberSuffix = NormalizeOptional(request.ContractNumberSuffix),
                ProjectNumber = NormalizeOptional(request.ProjectNumber),
                ContractDate = request.ContractDate,
                Company = company,
                CustomerProject = NormalizeOptional(request.CustomerProject),
                WorkOrderNumber = NormalizeOptional(request.WorkOrderNumber),
                ReferenceNumber = NormalizeOptional(request.ReferenceNumber),
                PartName = NormalizeOptional(request.PartName),
                MoldCount = request.MoldCount ?? 1,
                TotalAmount = request.TotalAmount,
                Currency = currency,
                ExchangeRateType = NormalizeOptional(request.ExchangeRateType),
                FixedExchangeRate = request.FixedExchangeRate,
            };

            db.Contracts.Add(contract);
            await db.SaveChangesAsync(cancellationToken);

            var createdContract = await GetContractDetailAsync(
                db,
                contract.Id,
                cancellationToken);

            return Results.Created($"/api/contracts/{contract.Id}", createdContract);
        })
        .WithName("CreateContract");

        return app;
    }

    private static async Task<ContractDetailResponse?> GetContractDetailAsync(
        DnaKalipDbContext db,
        Guid id,
        CancellationToken cancellationToken)
    {
        return await db.Contracts
            .AsNoTracking()
            .Where(contract => contract.Id == id)
            .Select(contract => new ContractDetailResponse(
                contract.Id,
                contract.ContractNumber,
                contract.FinanceTab,
                contract.ContractType,
                contract.ContractYear,
                contract.ContractNumberSuffix,
                contract.ProjectNumber,
                contract.ContractDate,
                contract.Company == null
                    ? null
                    : new CompanySummaryResponse(
                        contract.Company.Id,
                        contract.Company.Name,
                        contract.Company.CompanyType,
                        contract.Company.TaxNumber,
                        contract.Company.Email,
                        contract.Company.Phone),
                contract.CustomerProject,
                contract.WorkOrderNumber,
                contract.ReferenceNumber,
                contract.PartName,
                contract.MoldCount,
                contract.TotalAmount,
                contract.Currency,
                contract.ExchangeRateType,
                contract.FixedExchangeRate,
                contract.Milestones
                    .OrderBy(milestone => milestone.SortOrder)
                    .Select(milestone => new ContractMilestoneResponse(
                        milestone.Id,
                        milestone.TrackingKey,
                        milestone.MilestoneIndex,
                        milestone.SubMilestoneIndex,
                        milestone.Condition,
                        milestone.SubMilestoneName,
                        milestone.Rate,
                        milestone.Amount,
                        milestone.DueDays,
                        milestone.SortOrder,
                        milestone.PaymentTracking == null
                            ? null
                            : new PaymentTrackingResponse(
                                milestone.PaymentTracking.Id,
                                milestone.PaymentTracking.ApprovalDate,
                                milestone.PaymentTracking.PaymentDate,
                                milestone.PaymentTracking.Status,
                                milestone.PaymentTracking.DueDaysOverride)))
                    .ToList()))
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static Dictionary<string, string[]> ValidateCreateContractRequest(
        CreateContractRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        var financeTab = request.FinanceTab?.Trim().ToLowerInvariant();
        var currency = request.Currency?.Trim().ToUpperInvariant();

        AddErrorIf(
            errors,
            string.IsNullOrWhiteSpace(request.ContractNumber),
            "contractNumber",
            "Sözleşme numarası zorunludur.");

        AddErrorIf(
            errors,
            financeTab is not ("musteri" or "tedarikci"),
            "financeTab",
            "Sözleşme türü musteri veya tedarikci olmalıdır.");

        AddErrorIf(
            errors,
            request.CompanyId is null && string.IsNullOrWhiteSpace(request.CompanyName),
            "company",
            "Firma seçimi veya firma adı zorunludur.");

        AddErrorIf(
            errors,
            currency is not ("TRY" or "EUR" or "USD"),
            "currency",
            "Para birimi TRY, EUR veya USD olmalıdır.");

        AddErrorIf(
            errors,
            request.TotalAmount < 0,
            "totalAmount",
            "Sözleşme tutarı negatif olamaz.");

        AddErrorIf(
            errors,
            request.MoldCount is not null && request.MoldCount < 1,
            "moldCount",
            "Kalıp sayısı en az 1 olmalıdır.");

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

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
