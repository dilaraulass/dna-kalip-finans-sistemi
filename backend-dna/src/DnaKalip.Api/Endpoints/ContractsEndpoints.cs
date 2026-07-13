using DnaKalip.Api.Data;
using DnaKalip.Api.Dtos.Contracts;
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
            var contract = await db.Contracts
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

            return contract is null
                ? Results.NotFound()
                : Results.Ok(contract);
        })
        .WithName("GetContractById");

        return app;
    }
}
