using DnaKalip.Api.Data;
using DnaKalip.Api.Domain;
using DnaKalip.Api.Dtos.Contracts;
using DnaKalip.Api.Entities;
using DnaKalip.Api.Services.Contracts;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Numerics;
using System.Security.Claims;
using DnaKalip.Api.Services.Security;

namespace DnaKalip.Api.Endpoints;

public static class ContractsEndpoints
{
    public static IEndpointRouteBuilder MapContractsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/contracts")
            .RequireAuthorization(Permissions.ContractsView)
            .AddEndpointFilter<FinancialVisibilityFilter>()
            .WithTags("Contracts");

        group.MapGet("/number-suggestions", async (
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var contracts = await db.Contracts.AsNoTracking()
                .Select(item => new { item.FinanceTab, item.ContractNumberSuffix, item.ContractNumber })
                .ToListAsync(cancellationToken);
            var suggestions = new Dictionary<string, string>();

            foreach (var tab in new[] { "musteri", "tedarikci" })
            {
                var maximum = BigInteger.Zero;
                var width = 3;
                foreach (var contract in contracts.Where(item => item.FinanceTab == tab))
                {
                    var suffix = string.IsNullOrWhiteSpace(contract.ContractNumberSuffix)
                        ? contract.ContractNumber.Split('-').Last().Trim()
                        : contract.ContractNumberSuffix.Trim();
                    if (suffix.Length == 0 || !suffix.All(char.IsAsciiDigit) ||
                        !BigInteger.TryParse(suffix, NumberStyles.None, CultureInfo.InvariantCulture, out var number))
                        continue;

                    if (number > maximum)
                    {
                        maximum = number;
                        width = Math.Max(3, suffix.Length);
                    }
                }

                suggestions[tab] = (maximum + 1).ToString(CultureInfo.InvariantCulture).PadLeft(width, '0');
            }

            return Results.Ok(suggestions);
        }).WithName("GetContractNumberSuggestions");

        group.MapGet(string.Empty, async (
            string? archiveStatus,
            ClaimsPrincipal principal,
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var normalizedArchiveStatus = (archiveStatus ?? "active").Trim().ToLowerInvariant();

            if (normalizedArchiveStatus is not ("active" or "archived" or "all"))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["archiveStatus"] = ["archiveStatus active, archived veya all olmalıdır."],
                });
            }

            var query = db.Contracts.AsNoTracking();
            var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
            if (!principal.IsInRole(AppRoles.Admin))
                query = query.Where(c => c.WorkflowStatus == "active" || c.CreatedByUserId == userId || c.AssignedToUserId == userId);

            query = normalizedArchiveStatus switch
            {
                "active" => query.Where(contract => !contract.IsArchived),
                "archived" => query.Where(contract => contract.IsArchived),
                _ => query,
            };

            var contracts = await query
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
                    contract.IsArchived,
                    contract.ArchivedAt,
                    contract.Milestones.Count,
                    contract.Milestones.Count(milestone =>
                        milestone.PaymentTracking != null &&
                        milestone.PaymentTracking.Status == PaymentStatuses.Paid),
                    contract.WorkflowStatus, contract.CreatedByUserId, contract.AssignedToUserId))
                .ToListAsync(cancellationToken);

            return Results.Ok(contracts);
        })
        .WithName("GetContracts");

        group.MapGet("/{id:guid}", async (
            Guid id,
            ClaimsPrincipal principal,
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var contract = await GetContractDetailAsync(db, id, cancellationToken);
            var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
            if (contract is not null && contract.WorkflowStatus != "active" && !principal.IsInRole(AppRoles.Admin) &&
                contract.CreatedByUserId != userId && contract.AssignedToUserId != userId) return Results.NotFound();

            return contract is null
                ? Results.NotFound()
                : Results.Ok(contract);
        })
        .WithName("GetContractById");

        group.MapPost(string.Empty, async (
            CreateContractRequest request,
            ClaimsPrincipal principal,
            AccessService access,
            DnaKalipDbContext db,
            ContractMilestoneSyncService milestoneSyncService,
            CancellationToken cancellationToken) =>
        {
            var canFinance = principal.Has(Permissions.FinanceEdit);
            if (!canFinance) request = request with { TotalAmount = 0, Currency = "EUR", FixedExchangeRate = null,
                ExchangeRateType = null, FormDataJson = FinancialVisibility.TechnicalJson(request.FormDataJson), SaveAsDraft = true };
            var validationErrors = ValidateCreateContractRequest(request);
            if (!request.SaveAsDraft && request.TotalAmount <= 0) validationErrors["totalAmount"] = ["Aktif sözleşme tutarı sıfırdan büyük olmalıdır."];

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
                WorkflowStatus = request.SaveAsDraft ? "draft" : "active",
                CreatedByUserId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!),
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
                FormDataJson = NormalizeOptional(request.FormDataJson),
            };

            milestoneSyncService.SyncFromFormData(contract);
            if (contract.WorkflowStatus == "active" && (contract.Milestones.Count == 0 ||
                Math.Abs(contract.Milestones.Sum(m => m.Amount) - contract.TotalAmount) > 0.05m))
                return Results.BadRequest(new { message = "Aktif sözleşme için ödeme planının toplamı sözleşme bedeliyle eşleşmelidir." });

            db.Contracts.Add(contract);
            access.Audit(principal, "contract.create", contract.Id, new { contract.WorkflowStatus });
            await db.SaveChangesAsync(cancellationToken);

            var createdContract = await GetContractDetailAsync(
                db,
                contract.Id,
                cancellationToken);

            return Results.Created($"/api/contracts/{contract.Id}", createdContract);
        })
        .WithName("CreateContract").RequireAuthorization(Permissions.ContractsEdit);

        group.MapPut("/{id:guid}", async (
            Guid id,
            UpdateContractRequest request,
            ClaimsPrincipal principal,
            AccessService access,
            DnaKalipDbContext db,
            ContractMilestoneSyncService milestoneSyncService,
            CancellationToken cancellationToken) =>
        {
            var canFinance = principal.Has(Permissions.FinanceEdit);
            if (!canFinance) request = request with { TotalAmount = 0, Currency = "EUR", FixedExchangeRate = null,
                ExchangeRateType = null, FormDataJson = FinancialVisibility.TechnicalJson(request.FormDataJson) };
            var validationErrors = ValidateUpdateContractRequest(request);

            if (validationErrors.Count > 0)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var contract = await db.Contracts
                .Include(item => item.Milestones)
                .ThenInclude(milestone => milestone.PaymentTracking)
                .FirstOrDefaultAsync(
                    item => item.Id == id,
                    cancellationToken);

            if (contract is null)
            {
                return Results.NotFound();
            }

            var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
            if (contract.IsArchived) return Results.BadRequest(new { message = "Silinen sözleşme düzenlenemez." });
            if (!principal.IsInRole(AppRoles.Admin) && contract.WorkflowStatus != "active" && contract.CreatedByUserId != userId && contract.AssignedToUserId != userId)
                return Results.NotFound();
            if (!canFinance && (contract.WorkflowStatus != "draft" || contract.CreatedByUserId != userId)) return Results.Forbid();
            if (contract.WorkflowStatus == "pending" && !principal.IsInRole(AppRoles.Admin) && contract.AssignedToUserId != userId) return Results.Forbid();
            if (request.Version != Convert.ToBase64String(contract.Version))
                return Results.Conflict(new { message = "Sözleşme değişmiş. Yenileyip tekrar deneyin." });
            if (contract.WorkflowStatus == "active" && request.TotalAmount <= 0)
                return Results.BadRequest(new { message = "Aktif sözleşme tutarı sıfırdan büyük olmalıdır." });

            var contractNumber = request.ContractNumber.Trim();
            var financeTab = request.FinanceTab.Trim().ToLowerInvariant();
            var currency = request.Currency.Trim().ToUpperInvariant();
            var companyName = request.CompanyName?.Trim();

            var contractNumberExists = await db.Contracts
                .AnyAsync(
                    item => item.Id != id && item.ContractNumber == contractNumber,
                    cancellationToken);

            if (contractNumberExists)
            {
                return Results.Conflict(new
                {
                    message = "Bu sözleşme numarasıyla başka bir kayıt zaten var.",
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

            contract.ContractNumber = contractNumber;
            contract.FinanceTab = financeTab;
            contract.ContractType = NormalizeOptional(request.ContractType);
            contract.ContractYear = request.ContractYear ?? contract.ContractYear;
            contract.ContractNumberSuffix = NormalizeOptional(request.ContractNumberSuffix);
            contract.ProjectNumber = NormalizeOptional(request.ProjectNumber);
            contract.ContractDate = request.ContractDate;
            contract.Company = company;
            contract.CustomerProject = NormalizeOptional(request.CustomerProject);
            contract.WorkOrderNumber = NormalizeOptional(request.WorkOrderNumber);
            contract.ReferenceNumber = NormalizeOptional(request.ReferenceNumber);
            contract.PartName = NormalizeOptional(request.PartName);
            contract.MoldCount = request.MoldCount ?? 1;
            if (canFinance)
            {
                contract.TotalAmount = request.TotalAmount;
                contract.Currency = currency;
                contract.ExchangeRateType = NormalizeOptional(request.ExchangeRateType);
                contract.FixedExchangeRate = request.FixedExchangeRate;
                contract.FormDataJson = NormalizeOptional(request.FormDataJson);
            }
            else
            {
                // Preserve hidden financial fields when a returned draft is edited technically.
                var existing = System.Text.Json.Nodes.JsonNode.Parse(contract.FormDataJson ?? "{}")!.AsObject();
                var technical = System.Text.Json.Nodes.JsonNode.Parse(request.FormDataJson ?? "{}")!.AsObject();
                foreach (var field in FinancialVisibility.TechnicalFields)
                    if (technical.TryGetPropertyValue(field, out var value)) existing[field] = value?.DeepClone();
                contract.FormDataJson = existing.ToJsonString();
            }

            if (canFinance)
            {
                var existingMilestoneIds = contract.Milestones.Select(m => m.Id).ToHashSet();
                var existingTrackingIds = contract.Milestones.Where(m => m.PaymentTracking is not null)
                    .Select(m => m.PaymentTracking!.Id).ToHashSet();
                milestoneSyncService.SyncFromFormData(contract);
                // New entities already have GUIDs. Mark them explicitly as inserts when added to a tracked graph.
                foreach (var milestone in contract.Milestones)
                {
                    if (!existingMilestoneIds.Contains(milestone.Id)) db.ContractMilestones.Add(milestone);
                    if (milestone.PaymentTracking is { } tracking && !existingTrackingIds.Contains(tracking.Id))
                        db.PaymentTrackings.Add(tracking);
                }
            }
            if (contract.WorkflowStatus == "active" && contract.Milestones.Count == 0)
                return Results.BadRequest(new { message = "Aktif sözleşme için ödeme planı gereklidir." });
            access.Audit(principal, "contract.update", contract.Id, new { contract.WorkflowStatus });
            await db.SaveChangesAsync(cancellationToken);

            var updatedContract = await GetContractDetailAsync(
                db,
                contract.Id,
                cancellationToken);

            return Results.Ok(updatedContract);
        })
        .WithName("UpdateContract").RequireAuthorization(Permissions.ContractsEdit);

        group.MapPatch("/{id:guid}/archive", async (
            Guid id,
            ClaimsPrincipal principal,
            AccessService access,
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var contract = await db.Contracts
                .FirstOrDefaultAsync(
                    item => item.Id == id,
                    cancellationToken);

            if (contract is null)
            {
                return Results.NotFound();
            }

            var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
            if (contract.WorkflowStatus != "active" && !principal.IsInRole(AppRoles.Admin) &&
                contract.CreatedByUserId != userId && contract.AssignedToUserId != userId) return Results.NotFound();
            if (!contract.IsArchived)
            {
                contract.IsArchived = true;
                contract.ArchivedAt = DateTimeOffset.UtcNow;
                access.Audit(principal, "contract.archive", id, new { contract.WorkflowStatus });
                await db.SaveChangesAsync(cancellationToken);
            }

            return Results.NoContent();
        })
        .WithName("ArchiveContract").RequireAuthorization(Permissions.FinanceEdit);

        group.MapPatch("/{id:guid}/restore", async (
            Guid id,
            ClaimsPrincipal principal,
            AccessService access,
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var contract = await db.Contracts
                .FirstOrDefaultAsync(
                    item => item.Id == id,
                    cancellationToken);

            if (contract is null)
            {
                return Results.NotFound();
            }

            var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
            if (contract.WorkflowStatus != "active" && !principal.IsInRole(AppRoles.Admin) &&
                contract.CreatedByUserId != userId && contract.AssignedToUserId != userId) return Results.NotFound();
            if (contract.IsArchived)
            {
                contract.IsArchived = false;
                contract.ArchivedAt = null;
                access.Audit(principal, "contract.restore", id, new { contract.WorkflowStatus });
                await db.SaveChangesAsync(cancellationToken);
            }

            return Results.NoContent();
        })
        .WithName("RestoreContract").RequireAuthorization(Permissions.FinanceEdit);

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
                contract.FormDataJson,
                contract.IsArchived,
                contract.ArchivedAt,
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
                    .ToList(), contract.WorkflowStatus, contract.CreatedByUserId, contract.AssignedToUserId,
                contract.ReturnReason, contract.Version))
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
            financeTab is not (FinanceTabs.Customer or FinanceTabs.Supplier),
            "financeTab",
            "Sözleşme türü musteri veya tedarikci olmalıdır.");

        AddErrorIf(
            errors,
            request.CompanyId is null && string.IsNullOrWhiteSpace(request.CompanyName),
            "company",
            "Firma seçimi veya firma adı zorunludur.");

        AddErrorIf(
            errors,
            currency is not (Currencies.Try or Currencies.Eur or Currencies.Usd),
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

    private static Dictionary<string, string[]> ValidateUpdateContractRequest(
        UpdateContractRequest request)
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
            financeTab is not (FinanceTabs.Customer or FinanceTabs.Supplier),
            "financeTab",
            "Sözleşme türü musteri veya tedarikci olmalıdır.");

        AddErrorIf(
            errors,
            request.CompanyId is null && string.IsNullOrWhiteSpace(request.CompanyName),
            "company",
            "Firma seçimi veya firma adı zorunludur.");

        AddErrorIf(
            errors,
            currency is not (Currencies.Try or Currencies.Eur or Currencies.Usd),
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
