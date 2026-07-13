using System.Globalization;
using System.Text.Json;
using DnaKalip.Api.Data;
using DnaKalip.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace DnaKalip.Api.Services.Development;

public sealed class JsonSeedService(
    DnaKalipDbContext dbContext,
    IWebHostEnvironment environment,
    IConfiguration configuration)
{
    private static readonly CultureInfo TurkishCulture = CultureInfo.GetCultureInfo("tr-TR");

    public async Task<JsonSeedResult> SeedFromJsonAsync(CancellationToken cancellationToken)
    {
        var sourcePath = ResolveSourcePath();
        await using var stream = File.OpenRead(sourcePath);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

        if (document.RootElement.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidOperationException("Seed JSON root must be an array.");
        }

        var companies = await dbContext.Companies
            .ToDictionaryAsync(company => company.Name, StringComparer.OrdinalIgnoreCase, cancellationToken);
        var existingContractNumbers = await dbContext.Contracts
            .Select(contract => contract.ContractNumber)
            .ToHashSetAsync(StringComparer.OrdinalIgnoreCase, cancellationToken);
        var existingInvoiceKeys = await dbContext.ExpenseInvoices
            .Select(invoice => new
            {
                invoice.WorkOrderNumber,
                invoice.InvoiceType,
                invoice.Description,
                invoice.Amount,
                invoice.InvoiceDate,
            })
            .ToListAsync(cancellationToken);
        var invoiceKeys = existingInvoiceKeys
            .Select(invoice => BuildInvoiceKey(
                invoice.WorkOrderNumber,
                invoice.InvoiceType,
                invoice.Description,
                invoice.Amount,
                invoice.InvoiceDate))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var existingExchangeRates = await dbContext.ExchangeRates
            .Select(rate => new { rate.Currency, rate.EffectiveDate })
            .ToListAsync(cancellationToken);
        var exchangeRateKeys = existingExchangeRates
            .Select(rate => $"{rate.Currency}:{rate.EffectiveDate:yyyy-MM-dd}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var counters = new SeedCounters();
        var effectiveDate = DateOnly.FromDateTime(DateTime.UtcNow);

        foreach (var item in document.RootElement.EnumerateArray())
        {
            var id = GetString(item, "id");

            if (id == "SYSTEM_EXPENSES_DB")
            {
                SeedExpenseInvoices(item, invoiceKeys, counters);
                continue;
            }

            if (id == "SYSTEM_SETTINGS_DB")
            {
                SeedExchangeRates(item, exchangeRateKeys, effectiveDate, counters);
                continue;
            }

            SeedContract(item, companies, existingContractNumbers, counters);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return new JsonSeedResult(
            counters.CompaniesCreated,
            counters.ContractsCreated,
            counters.ContractsSkipped,
            counters.MilestonesCreated,
            counters.PaymentTrackingsCreated,
            counters.ExpenseInvoicesCreated,
            counters.ExpenseInvoicesSkipped,
            counters.ExchangeRatesCreated,
            sourcePath);
    }

    private string ResolveSourcePath()
    {
        var configuredPath = configuration["SeedData:DatabaseJsonPath"];
        var sourcePath = string.IsNullOrWhiteSpace(configuredPath)
            ? Path.GetFullPath(Path.Combine(
                environment.ContentRootPath,
                "..",
                "..",
                "..",
                "src",
                "data",
                "database.json"))
            : Path.GetFullPath(Path.Combine(environment.ContentRootPath, configuredPath));

        if (!File.Exists(sourcePath))
        {
            throw new FileNotFoundException("Seed JSON file could not be found.", sourcePath);
        }

        return sourcePath;
    }

    private void SeedContract(
        JsonElement item,
        Dictionary<string, Company> companies,
        HashSet<string> existingContractNumbers,
        SeedCounters counters)
    {
        var finance = GetObject(item, "finansData");
        var formData = GetObject(item, "formData");
        var trackingData = GetObject(item, "odemeTakibi");
        var contractNumber = GetString(finance, "tamSozlesmeNo")
            ?? GetString(finance, "sozlesmeNo")
            ?? GetString(item, "id");

        if (string.IsNullOrWhiteSpace(contractNumber))
        {
            counters.ContractsSkipped++;
            return;
        }

        if (!existingContractNumbers.Add(contractNumber))
        {
            counters.ContractsSkipped++;
            return;
        }

        var financeTab = GetString(finance, "sekme") ?? string.Empty;
        var companyName = GetString(finance, "tedarikci")
            ?? GetString(item, "tedarikci")
            ?? GetString(finance, "firmaAdi")
            ?? GetString(finance, "musteriFirma")
            ?? "Bilinmeyen Firma";
        var company = GetOrCreateCompany(companyName, financeTab, companies, counters);
        var totalAmount = GetDecimal(finance, "toplamTutarNum")
            ?? GetDecimal(finance, "toplamBedel")
            ?? GetDecimal(item, "toplamBedel")
            ?? 0;
        var currency = NormalizeCurrency(GetString(finance, "paraBirimi") ?? GetString(item, "paraBirimi") ?? "EUR");
        var moldCount = GetInt(finance, "kalipAdeti")
            ?? GetInt(formData, "kalipAdeti")
            ?? GetInt(item, "kalipAdeti")
            ?? 1;

        if (moldCount <= 0)
        {
            moldCount = 1;
        }

        var contract = new Contract
        {
            ContractNumber = contractNumber,
            FinanceTab = financeTab,
            ContractType = GetString(finance, "sozlesmeTuru"),
            ContractYear = GetInt(finance, "sozlesmeYili"),
            ContractNumberSuffix = GetString(finance, "sozlesmeNoSuffix"),
            ProjectNumber = GetString(finance, "projeNo"),
            ContractDate = GetDate(finance, "sozlesmeTarihi") ?? GetDate(formData, "tarih"),
            Company = company,
            CustomerProject = GetString(finance, "musteriProjesi"),
            WorkOrderNumber = GetString(finance, "dnaIsEmriNo") ?? GetString(finance, "projeNo"),
            ReferenceNumber = GetString(finance, "referansNo"),
            PartName = GetString(finance, "parcaAdi"),
            MoldCount = moldCount,
            TotalAmount = totalAmount,
            Currency = currency,
            ExchangeRateType = GetString(finance, "kurTipi"),
            FixedExchangeRate = GetDecimal(finance, "sabitKurDegeri"),
        };

        SeedMilestones(contract, finance, formData, trackingData, totalAmount, financeTab, moldCount, counters);

        dbContext.Contracts.Add(contract);
        counters.ContractsCreated++;
    }

    private Company GetOrCreateCompany(
        string companyName,
        string financeTab,
        Dictionary<string, Company> companies,
        SeedCounters counters)
    {
        if (companies.TryGetValue(companyName, out var existingCompany))
        {
            return existingCompany;
        }

        var company = new Company
        {
            Name = companyName,
            CompanyType = financeTab,
        };

        companies[companyName] = company;
        counters.CompaniesCreated++;

        return company;
    }

    private static void SeedMilestones(
        Contract contract,
        JsonElement finance,
        JsonElement formData,
        JsonElement trackingData,
        decimal totalAmount,
        string financeTab,
        int moldCount,
        SeedCounters counters)
    {
        var milestones = GetArray(finance, "hakedisler");
        var sortOrder = 0;

        for (var milestoneIndex = 0; milestoneIndex < milestones.Count; milestoneIndex++)
        {
            var milestone = milestones[milestoneIndex];
            var rate = GetDecimal(milestone, "oran");
            var amount = GetDecimal(milestone, "tutarStr")
                ?? GetDecimal(milestone, "tutar")
                ?? (rate.HasValue && totalAmount > 0 ? totalAmount * rate.Value / 100 : 0);
            var dueDays = ExtractFirstInt(GetString(milestone, "vadeSarti") ?? GetString(milestone, "vade"));
            var subMilestones = FindSubMilestones(milestone);

            if (financeTab != "musteri" && subMilestones.Count == 0 && moldCount > 1 && milestoneIndex == 0)
            {
                for (var subIndex = 0; subIndex < moldCount; subIndex++)
                {
                    var trackingKey = $"h_{milestoneIndex}_alt_{subIndex}";
                    var subAmount = GetMoldAmount(formData, subIndex) ?? amount / moldCount;

                    AddMilestone(
                        contract,
                        trackingData,
                        milestone,
                        trackingKey,
                        milestoneIndex,
                        subIndex,
                        $"{subIndex + 1}. Kalıp",
                        rate,
                        subAmount,
                        dueDays,
                        sortOrder++,
                        counters);
                }

                continue;
            }

            if (subMilestones.Count > 0)
            {
                for (var subIndex = 0; subIndex < subMilestones.Count; subIndex++)
                {
                    var subMilestone = subMilestones[subIndex];
                    var trackingKey = $"h_{milestoneIndex}_alt_{subIndex}";
                    var subAmount = GetDecimal(subMilestone, "tutar") ?? amount / subMilestones.Count;
                    var subName = GetString(subMilestone, "isim") ?? GetString(subMilestone, "ad");

                    AddMilestone(
                        contract,
                        trackingData,
                        milestone,
                        trackingKey,
                        milestoneIndex,
                        subIndex,
                        subName,
                        rate,
                        subAmount,
                        dueDays,
                        sortOrder++,
                        counters);
                }

                continue;
            }

            AddMilestone(
                contract,
                trackingData,
                milestone,
                $"h_{milestoneIndex}",
                milestoneIndex,
                null,
                null,
                rate,
                amount,
                dueDays,
                sortOrder++,
                counters);
        }
    }

    private static void AddMilestone(
        Contract contract,
        JsonElement trackingData,
        JsonElement milestoneJson,
        string trackingKey,
        int milestoneIndex,
        int? subMilestoneIndex,
        string? subMilestoneName,
        decimal? rate,
        decimal amount,
        int dueDays,
        int sortOrder,
        SeedCounters counters)
    {
        var milestone = new ContractMilestone
        {
            TrackingKey = trackingKey,
            MilestoneIndex = milestoneIndex,
            SubMilestoneIndex = subMilestoneIndex,
            Condition = GetString(milestoneJson, "sart") ?? GetString(milestoneJson, "sartAna"),
            SubMilestoneName = subMilestoneName,
            Rate = rate,
            Amount = amount,
            DueDays = dueDays,
            SortOrder = sortOrder,
        };

        var tracking = GetObject(trackingData, trackingKey);

        if (tracking.ValueKind == JsonValueKind.Object)
        {
            milestone.PaymentTracking = new PaymentTracking
            {
                ApprovalDate = GetDate(tracking, "onayTarihi"),
                PaymentDate = GetDate(tracking, "odemeTarihi"),
                Status = GetString(tracking, "durum") == "paid" ? "paid" : "pending",
                DueDaysOverride = GetInt(tracking, "vade"),
            };
            counters.PaymentTrackingsCreated++;
        }

        contract.Milestones.Add(milestone);
        counters.MilestonesCreated++;
    }

    private void SeedExpenseInvoices(
        JsonElement item,
        HashSet<string> invoiceKeys,
        SeedCounters counters)
    {
        var invoices = GetArray(item, "faturalar");

        foreach (var invoiceJson in invoices)
        {
            var invoiceDate = GetDate(invoiceJson, "date");

            if (!invoiceDate.HasValue)
            {
                counters.ExpenseInvoicesSkipped++;
                continue;
            }

            var workOrder = GetString(invoiceJson, "isEmri") ?? "GENEL";
            var invoiceType = GetString(invoiceJson, "type");
            var description = GetString(invoiceJson, "desc") ?? "-";
            var amount = GetDecimal(invoiceJson, "amount") ?? 0;
            var invoiceKey = BuildInvoiceKey(workOrder, invoiceType, description, amount, invoiceDate.Value);

            if (!invoiceKeys.Add(invoiceKey))
            {
                counters.ExpenseInvoicesSkipped++;
                continue;
            }

            dbContext.ExpenseInvoices.Add(new ExpenseInvoice
            {
                WorkOrderNumber = workOrder,
                InvoiceType = invoiceType,
                Description = description,
                Amount = amount,
                Currency = NormalizeCurrency(GetString(invoiceJson, "currency") ?? "TRY"),
                InvoiceDate = invoiceDate.Value,
                DueDays = GetInt(invoiceJson, "vade") ?? 0,
                PaymentDate = GetDate(invoiceJson, "paymentDate"),
                Status = GetString(invoiceJson, "status") == "paid" ? "paid" : "pending",
            });
            counters.ExpenseInvoicesCreated++;
        }
    }

    private void SeedExchangeRates(
        JsonElement item,
        HashSet<string> exchangeRateKeys,
        DateOnly effectiveDate,
        SeedCounters counters)
    {
        var exchangeRates = GetObject(item, "exchangeRates");

        if (exchangeRates.ValueKind != JsonValueKind.Object)
        {
            return;
        }

        foreach (var rateProperty in exchangeRates.EnumerateObject())
        {
            var currency = NormalizeCurrency(rateProperty.Name);
            var key = $"{currency}:{effectiveDate:yyyy-MM-dd}";

            if (!exchangeRateKeys.Add(key))
            {
                continue;
            }

            dbContext.ExchangeRates.Add(new ExchangeRate
            {
                Currency = currency,
                RateToTry = GetDecimal(rateProperty.Value) ?? 0,
                EffectiveDate = effectiveDate,
            });
            counters.ExchangeRatesCreated++;
        }
    }

    private static string BuildInvoiceKey(
        string? workOrder,
        string? invoiceType,
        string description,
        decimal amount,
        DateOnly invoiceDate)
    {
        return string.Join(
            "|",
            workOrder ?? string.Empty,
            invoiceType ?? string.Empty,
            description,
            amount.ToString("0.00", CultureInfo.InvariantCulture),
            invoiceDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
    }

    private static IReadOnlyList<JsonElement> FindSubMilestones(JsonElement milestone)
    {
        foreach (var propertyName in new[] { "altKaliplar", "kaliplar", "altOdemeler", "parcalar" })
        {
            var subMilestones = GetArray(milestone, propertyName);

            if (subMilestones.Count > 0)
            {
                return subMilestones;
            }
        }

        return [];
    }

    private static decimal? GetMoldAmount(JsonElement formData, int subIndex)
    {
        var moldAmounts = GetObject(formData, "kalipTutarlari");

        if (moldAmounts.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        return moldAmounts.TryGetProperty(subIndex.ToString(CultureInfo.InvariantCulture), out var amount)
            ? GetDecimal(amount)
            : null;
    }

    private static string NormalizeCurrency(string currency)
    {
        return currency == "TL" ? "TRY" : currency;
    }

    private static JsonElement GetObject(JsonElement element, string propertyName)
    {
        return element.ValueKind == JsonValueKind.Object && element.TryGetProperty(propertyName, out var value)
            ? value
            : default;
    }

    private static IReadOnlyList<JsonElement> GetArray(JsonElement element, string propertyName)
    {
        if (element.ValueKind != JsonValueKind.Object ||
            !element.TryGetProperty(propertyName, out var value) ||
            value.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        return value.EnumerateArray().ToArray();
    }

    private static string? GetString(JsonElement element, string propertyName)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(propertyName, out var value))
        {
            return null;
        }

        return value.ValueKind switch
        {
            JsonValueKind.String => string.IsNullOrWhiteSpace(value.GetString()) ? null : value.GetString(),
            JsonValueKind.Number => value.GetRawText(),
            _ => null,
        };
    }

    private static decimal? GetDecimal(JsonElement element, string propertyName)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(propertyName, out var value))
        {
            return null;
        }

        return GetDecimal(value);
    }

    private static decimal? GetDecimal(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var decimalValue))
        {
            return decimalValue;
        }

        if (value.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var normalized = new string(value.GetString()?
            .Where(character => char.IsDigit(character) || character is ',' or '.' or '-')
            .ToArray());

        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        if (normalized.Contains('.') && normalized.Contains(','))
        {
            normalized = normalized.Replace(".", string.Empty).Replace(',', '.');
        }
        else if (normalized.Contains(','))
        {
            normalized = normalized.Replace(',', '.');
        }
        else if (normalized.Count(character => character == '.') == 1)
        {
            var parts = normalized.Split('.');

            if (parts.Length == 2 && parts[1].Length == 3)
            {
                normalized = normalized.Replace(".", string.Empty);
            }
        }

        return decimal.TryParse(normalized, NumberStyles.Number, CultureInfo.InvariantCulture, out var result)
            ? result
            : null;
    }

    private static int? GetInt(JsonElement element, string propertyName)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(propertyName, out var value))
        {
            return null;
        }

        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var intValue))
        {
            return intValue;
        }

        return value.ValueKind == JsonValueKind.String &&
               int.TryParse(value.GetString(), NumberStyles.Integer, TurkishCulture, out var result)
            ? result
            : null;
    }

    private static DateOnly? GetDate(JsonElement element, string propertyName)
    {
        var value = GetString(element, propertyName);

        return DateOnly.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
            ? date
            : null;
    }

    private static int ExtractFirstInt(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return 0;
        }

        var digits = new string(value.Where(char.IsDigit).ToArray());

        return int.TryParse(digits, NumberStyles.Integer, CultureInfo.InvariantCulture, out var result)
            ? result
            : 0;
    }

    private sealed class SeedCounters
    {
        public int CompaniesCreated { get; set; }
        public int ContractsCreated { get; set; }
        public int ContractsSkipped { get; set; }
        public int MilestonesCreated { get; set; }
        public int PaymentTrackingsCreated { get; set; }
        public int ExpenseInvoicesCreated { get; set; }
        public int ExpenseInvoicesSkipped { get; set; }
        public int ExchangeRatesCreated { get; set; }
    }
}
