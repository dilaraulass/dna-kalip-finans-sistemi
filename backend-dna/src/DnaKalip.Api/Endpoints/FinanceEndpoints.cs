using DnaKalip.Api.Data;
using DnaKalip.Api.Domain;
using DnaKalip.Api.Dtos.Finance;
using DnaKalip.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace DnaKalip.Api.Endpoints;

public static class FinanceEndpoints
{
    private const int ApproachingDueDays = 14;

    public static IEndpointRouteBuilder MapFinanceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/finance")
            .WithTags("Finance");

        group.MapGet("/dashboard", async (
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            var paymentMilestones = await db.ContractMilestones
                .AsNoTracking()
                .Where(milestone => !milestone.Contract.IsArchived)
                .OrderBy(milestone => milestone.Contract.ContractDate)
                .ThenBy(milestone => milestone.Contract.ContractNumber)
                .ThenBy(milestone => milestone.SortOrder)
                .Select(milestone => new
                {
                    milestone.Id,
                    milestone.ContractId,
                    milestone.TrackingKey,
                    milestone.MilestoneIndex,
                    milestone.Condition,
                    milestone.SubMilestoneName,
                    milestone.Rate,
                    milestone.Amount,
                    milestone.DueDays,
                    ContractNumber = milestone.Contract.ContractNumber,
                    FinanceTab = milestone.Contract.FinanceTab,
                    Company = milestone.Contract.Company == null
                        ? "-"
                        : milestone.Contract.Company.Name,
                    WorkOrder = milestone.Contract.WorkOrderNumber,
                    ReferenceNumber = milestone.Contract.ReferenceNumber,
                    ContractDate = milestone.Contract.ContractDate,
                    ContractAmount = milestone.Contract.TotalAmount,
                    ContractCurrency = milestone.Contract.Currency,
                    ExchangeRateType = milestone.Contract.ExchangeRateType,
                    FixedExchangeRate = milestone.Contract.FixedExchangeRate,
                    PaymentTracking = milestone.PaymentTracking == null
                        ? null
                        : new
                        {
                            milestone.PaymentTracking.ApprovalDate,
                            milestone.PaymentTracking.PaymentDate,
                            milestone.PaymentTracking.Status,
                            milestone.PaymentTracking.DueDaysOverride,
                        },
                })
                .ToListAsync(cancellationToken);

            var paymentResponses = paymentMilestones
                .Select(milestone =>
                {
                    var paymentStatus = milestone.PaymentTracking?.Status == PaymentStatuses.Paid
                        ? PaymentStatuses.Paid
                        : PaymentStatuses.Pending;
                    var activeDueDays = milestone.PaymentTracking?.DueDaysOverride
                        ?? milestone.DueDays;
                    var status = GetStatus(
                        paymentStatus,
                        milestone.PaymentTracking?.PaymentDate ??
                            milestone.PaymentTracking?.ApprovalDate,
                        today);

                    return new FinancePaymentMilestoneResponse(
                        milestone.Id,
                        milestone.ContractId,
                        milestone.TrackingKey,
                        milestone.ContractNumber,
                        milestone.FinanceTab,
                        milestone.Company,
                        NormalizeDisplayValue(milestone.WorkOrder),
                        NormalizeDisplayValue(milestone.ReferenceNumber),
                        milestone.ContractDate,
                        milestone.ContractAmount,
                        NormalizeCurrency(milestone.ContractCurrency),
                        NormalizeCurrency(milestone.ContractCurrency),
                        NormalizeExchangeRateType(milestone.ExchangeRateType),
                        milestone.FixedExchangeRate,
                        milestone.Rate,
                        NormalizeDisplayValue(milestone.Condition),
                        milestone.SubMilestoneName ?? string.Empty,
                        milestone.Amount,
                        milestone.DueDays,
                        activeDueDays,
                        milestone.PaymentTracking?.ApprovalDate,
                        milestone.PaymentTracking?.PaymentDate,
                        paymentStatus,
                        status.StatusKey,
                        status.Status,
                        status.DaysUntilDue,
                        milestone.MilestoneIndex);
                })
                .ToList();

            var expenseInvoices = await db.ExpenseInvoices
                .AsNoTracking()
                .Where(invoice => !invoice.IsArchived)
                .OrderBy(invoice => invoice.InvoiceDate)
                .ThenBy(invoice => invoice.WorkOrderNumber)
                .Select(invoice => new
                {
                    invoice.Id,
                    invoice.WorkOrderNumber,
                    invoice.InvoiceType,
                    invoice.Description,
                    invoice.Amount,
                    invoice.Currency,
                    invoice.InvoiceDate,
                    invoice.DueDays,
                    invoice.PaymentDate,
                    invoice.Status,
                })
                .ToListAsync(cancellationToken);

            var expenseResponses = expenseInvoices
                .Select(invoice =>
                {
                    var paymentStatus = invoice.Status == PaymentStatuses.Paid
                        ? PaymentStatuses.Paid
                        : PaymentStatuses.Pending;
                    var expectedPaymentDate = invoice.InvoiceDate.AddDays(invoice.DueDays);
                    var paymentDateDifference = invoice.PaymentDate.HasValue
                        ? invoice.PaymentDate.Value.DayNumber - expectedPaymentDate.DayNumber
                        : (int?)null;
                    var status = GetStatus(
                        paymentStatus,
                        invoice.PaymentDate ?? expectedPaymentDate,
                        today);

                    return new FinanceExpenseInvoiceResponse(
                        invoice.Id,
                        NormalizeDisplayValue(invoice.WorkOrderNumber, "GENEL"),
                        NormalizeDisplayValue(invoice.InvoiceType),
                        invoice.Description,
                        invoice.Amount,
                        NormalizeCurrency(invoice.Currency),
                        invoice.InvoiceDate,
                        invoice.DueDays,
                        invoice.PaymentDate,
                        expectedPaymentDate,
                        paymentDateDifference,
                        paymentStatus,
                        status.StatusKey,
                        status.Status,
                        status.DaysUntilDue);
                })
                .ToList();

            var exchangeRateRows = await db.ExchangeRates
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            var exchangeRates = exchangeRateRows
                .GroupBy(rate => NormalizeCurrency(rate.Currency))
                .ToDictionary(
                    group => group.Key,
                    group => group
                        .OrderByDescending(rate => rate.EffectiveDate)
                        .ThenByDescending(rate => rate.CreatedAt)
                        .First()
                        .RateToTry);

            exchangeRates[Currencies.Try] = 1;

            return Results.Ok(new FinanceDashboardResponse(
                paymentResponses,
                expenseResponses,
                exchangeRates));
        })
        .WithName("GetFinanceDashboard");

        group.MapGet("/exchange-rates", async (
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var exchangeRateRows = await db.ExchangeRates
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            var latestRates = exchangeRateRows
                .GroupBy(rate => NormalizeCurrency(rate.Currency))
                .ToDictionary(
                    group => group.Key,
                    group => group
                        .OrderByDescending(rate => rate.EffectiveDate)
                        .ThenByDescending(rate => rate.CreatedAt)
                        .First());

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var rates = new List<ExchangeRateResponse>
            {
                new(
                    Currencies.Try,
                    1,
                    today,
                    DateTimeOffset.UtcNow),
            };

            foreach (var currency in new[] { Currencies.Eur, Currencies.Usd })
            {
                if (latestRates.TryGetValue(currency, out var rate))
                {
                    rates.Add(new ExchangeRateResponse(
                        NormalizeCurrency(rate.Currency),
                        rate.RateToTry,
                        rate.EffectiveDate,
                        rate.CreatedAt));
                }
            }

            return Results.Ok(rates);
        })
        .WithName("GetExchangeRates");

        group.MapPut("/exchange-rates/{currency}", async (
            string currency,
            UpsertExchangeRateRequest request,
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var normalizedCurrency = NormalizeCurrency(currency);
            var validationErrors = ValidateExchangeRateRequest(
                normalizedCurrency,
                request);

            if (validationErrors.Count > 0)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var effectiveDate = request.EffectiveDate ??
                DateOnly.FromDateTime(DateTime.UtcNow);

            var exchangeRate = await db.ExchangeRates
                .FirstOrDefaultAsync(
                    item =>
                        item.Currency == normalizedCurrency &&
                        item.EffectiveDate == effectiveDate,
                    cancellationToken);

            if (exchangeRate is null)
            {
                exchangeRate = new ExchangeRate
                {
                    Currency = normalizedCurrency,
                    EffectiveDate = effectiveDate,
                };

                db.ExchangeRates.Add(exchangeRate);
            }

            exchangeRate.RateToTry = request.RateToTry;

            await db.SaveChangesAsync(cancellationToken);

            return Results.Ok(new ExchangeRateResponse(
                exchangeRate.Currency,
                exchangeRate.RateToTry,
                exchangeRate.EffectiveDate,
                exchangeRate.CreatedAt));
        })
        .WithName("UpsertExchangeRate");

        app.MapPut("/api/contract-milestones/{milestoneId:guid}/payment-tracking", async (
            Guid milestoneId,
            UpdatePaymentTrackingRequest request,
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var validationErrors = ValidatePaymentTrackingRequest(request);

            if (validationErrors.Count > 0)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var milestoneExists = await db.ContractMilestones
                .AnyAsync(
                    item => item.Id == milestoneId,
                    cancellationToken);

            if (!milestoneExists)
            {
                return Results.NotFound();
            }

            var paymentTracking = await db.PaymentTrackings
                .FirstOrDefaultAsync(
                    item => item.ContractMilestoneId == milestoneId,
                    cancellationToken);

            if (paymentTracking is null)
            {
                paymentTracking = new PaymentTracking
                {
                    ContractMilestoneId = milestoneId,
                };

                db.PaymentTrackings.Add(paymentTracking);
            }

            paymentTracking.ApprovalDate = request.ApprovalDate;
            paymentTracking.PaymentDate = request.PaymentDate;
            paymentTracking.Status = request.Status.Trim().ToLowerInvariant();
            paymentTracking.DueDaysOverride = request.DueDaysOverride;

            await db.SaveChangesAsync(cancellationToken);

            return Results.NoContent();
        })
        .WithTags("Finance")
        .WithName("UpdatePaymentTracking");

        app.MapPost("/api/expense-invoices", async (
            CreateExpenseInvoiceRequest request,
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var validationErrors = ValidateExpenseInvoiceRequest(
                request.Description,
                request.Amount,
                request.Currency,
                request.DueDays,
                request.Status);

            if (validationErrors.Count > 0)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var invoice = new ExpenseInvoice
            {
                WorkOrderNumber = NormalizeOptional(request.WorkOrderNumber),
                InvoiceType = NormalizeOptional(request.InvoiceType),
                Description = request.Description.Trim(),
                Amount = request.Amount,
                Currency = NormalizeCurrency(request.Currency),
                InvoiceDate = request.InvoiceDate,
                DueDays = request.DueDays,
                PaymentDate = request.PaymentDate,
                Status = request.Status.Trim().ToLowerInvariant(),
            };

            db.ExpenseInvoices.Add(invoice);
            await db.SaveChangesAsync(cancellationToken);

            return Results.Created($"/api/expense-invoices/{invoice.Id}", new
            {
                invoice.Id,
            });
        })
        .WithTags("Finance")
        .WithName("CreateExpenseInvoice");

        app.MapPut("/api/expense-invoices/{id:guid}", async (
            Guid id,
            UpdateExpenseInvoiceRequest request,
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var validationErrors = ValidateExpenseInvoiceRequest(
                request.Description,
                request.Amount,
                request.Currency,
                request.DueDays,
                request.Status);

            if (validationErrors.Count > 0)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var invoice = await db.ExpenseInvoices
                .FirstOrDefaultAsync(
                    item => item.Id == id,
                    cancellationToken);

            if (invoice is null)
            {
                return Results.NotFound();
            }

            invoice.WorkOrderNumber = NormalizeOptional(request.WorkOrderNumber);
            invoice.InvoiceType = NormalizeOptional(request.InvoiceType);
            invoice.Description = request.Description.Trim();
            invoice.Amount = request.Amount;
            invoice.Currency = NormalizeCurrency(request.Currency);
            invoice.InvoiceDate = request.InvoiceDate;
            invoice.DueDays = request.DueDays;
            invoice.PaymentDate = request.PaymentDate;
            invoice.Status = request.Status.Trim().ToLowerInvariant();

            await db.SaveChangesAsync(cancellationToken);

            return Results.NoContent();
        })
        .WithTags("Finance")
        .WithName("UpdateExpenseInvoice");

        app.MapPatch("/api/expense-invoices/{id:guid}/archive", async (
            Guid id,
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var invoice = await db.ExpenseInvoices
                .FirstOrDefaultAsync(
                    item => item.Id == id,
                    cancellationToken);

            if (invoice is null)
            {
                return Results.NotFound();
            }

            if (!invoice.IsArchived)
            {
                invoice.IsArchived = true;
                invoice.ArchivedAt = DateTimeOffset.UtcNow;

                await db.SaveChangesAsync(cancellationToken);
            }

            return Results.NoContent();
        })
        .WithTags("Finance")
        .WithName("ArchiveExpenseInvoice");

        return app;
    }

    private static Dictionary<string, string[]> ValidatePaymentTrackingRequest(
        UpdatePaymentTrackingRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        var status = request.Status?.Trim().ToLowerInvariant();

        if (status is not (PaymentStatuses.Paid or PaymentStatuses.Pending))
        {
            errors["status"] = ["Durum paid veya pending olmalıdır."];
        }

        if (request.DueDaysOverride is < 0)
        {
            errors["dueDaysOverride"] = ["Vade negatif olamaz."];
        }

        return errors;
    }

    private static Dictionary<string, string[]> ValidateExpenseInvoiceRequest(
        string? description,
        decimal amount,
        string? currencyValue,
        int dueDays,
        string? statusValue)
    {
        var errors = new Dictionary<string, string[]>();
        var currency = currencyValue?.Trim().ToUpperInvariant();
        var status = statusValue?.Trim().ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(description))
        {
            errors["description"] = ["Açıklama zorunludur."];
        }

        if (amount < 0)
        {
            errors["amount"] = ["Tutar negatif olamaz."];
        }

        if (currency is not (Currencies.Try or Currencies.Eur or Currencies.Usd or Currencies.LegacyTry))
        {
            errors["currency"] = ["Para birimi TRY, EUR veya USD olmalıdır."];
        }

        if (dueDays < 0)
        {
            errors["dueDays"] = ["Vade negatif olamaz."];
        }

        if (status is not (PaymentStatuses.Paid or PaymentStatuses.Pending))
        {
            errors["status"] = ["Durum paid veya pending olmalıdır."];
        }

        return errors;
    }

    private static Dictionary<string, string[]> ValidateExchangeRateRequest(
        string currency,
        UpsertExchangeRateRequest request)
    {
        var errors = new Dictionary<string, string[]>();

        if (currency is not (Currencies.Eur or Currencies.Usd))
        {
            errors["currency"] = ["Sadece EUR ve USD kuru güncellenebilir. TRY temel para birimidir."];
        }

        if (request.RateToTry <= 0)
        {
            errors["rateToTry"] = ["Kur değeri sıfırdan büyük olmalıdır."];
        }

        return errors;
    }

    private static FinanceRowStatus GetStatus(
        string paymentStatus,
        DateOnly? targetDate,
        DateOnly today)
    {
        if (paymentStatus == PaymentStatuses.Paid)
        {
            return new FinanceRowStatus(
                FinanceStatusKeys.Paid,
                FinanceStatusLabels.Paid,
                null);
        }

        if (!targetDate.HasValue)
        {
            return new FinanceRowStatus(
                FinanceStatusKeys.Pending,
                FinanceStatusLabels.Pending,
                null);
        }

        var daysUntilDue = targetDate.Value.DayNumber - today.DayNumber;

        if (daysUntilDue < 0)
        {
            return new FinanceRowStatus(
                FinanceStatusKeys.Overdue,
                FinanceStatusLabels.Overdue,
                daysUntilDue);
        }

        if (daysUntilDue <= ApproachingDueDays)
        {
            return new FinanceRowStatus(
                FinanceStatusKeys.Approaching,
                FinanceStatusLabels.Approaching,
                daysUntilDue);
        }

        return new FinanceRowStatus(
            FinanceStatusKeys.Pending,
            FinanceStatusLabels.Pending,
            daysUntilDue);
    }

    private static string NormalizeCurrency(string? currency)
    {
        var normalizedCurrency = string.IsNullOrWhiteSpace(currency)
            ? Currencies.Try
            : currency.Trim().ToUpperInvariant();

        return normalizedCurrency == Currencies.LegacyTry
            ? Currencies.Try
            : normalizedCurrency;
    }

    private static string NormalizeExchangeRateType(string? exchangeRateType)
    {
        var normalizedType = string.IsNullOrWhiteSpace(exchangeRateType)
            ? string.Empty
            : exchangeRateType.Trim().ToLowerInvariant();

        return normalizedType switch
        {
            ExchangeRateTypes.FixedTurkish => ExchangeRateTypes.Fixed,
            ExchangeRateTypes.CurrentTurkish or ExchangeRateTypes.CurrentTurkishWithAccent =>
                ExchangeRateTypes.Current,
            _ => normalizedType,
        };
    }

    private static string NormalizeDisplayValue(
        string? value,
        string fallback = "-")
    {
        return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private sealed record FinanceRowStatus(
        string StatusKey,
        string Status,
        int? DaysUntilDue);
}
