using System.Globalization;
using System.Text.Json;
using DnaKalip.Api.Domain;
using DnaKalip.Api.Entities;

namespace DnaKalip.Api.Services.Contracts;

public sealed class ContractMilestoneSyncService
{
    private static readonly SupplierPaymentOption[] SupplierPaymentOptions =
    [
        new(
            "supplierPaymentOption1",
            [
                new(40, "supplierOpt1Amount40", "Kalıp tasarım onayı ve döküm/çelik siparişi sonrası, (+60 GÜN)", 60),
                new(20, "supplierOpt1Amount20a", "İlk numune (T0) basımı ve CMM raporu tesliminde, (+60 GÜN)", 60),
                new(20, "supplierOpt1Amount20b", "%90 ölçüm yeterliliğinde OFF-TOOL numune tesliminde, (+60 GÜN)", 60),
                new(20, "supplierOpt1Amount20c", "Kalıbın DNA KALIP sahasında seri üretim onayı sonrasında ödenecektir. (+60 GÜN)", 60),
            ]),
        new(
            "supplierPaymentOption2",
            [
                new(60, "supplierOpt2Amount60", "Kalıp tasarım onayı ve döküm/çelik malzemenin inmesi sonrasında, (+60 GÜN)", 60),
                new(40, "supplierOpt2Amount40", "Kalıbın DNA KALIP sahasına teslimi ve kalite onayları sonrasında. (+60 GÜN)", 60),
            ]),
        new(
            "supplierPaymentOption3",
            [
                new(100, "supplierOpt3Amount100", "Kalıp tasarımının tamamlanması ve DNA KALIP onayı sonrasında, (+60 GÜN)", 60),
            ]),
        new(
            "supplierPaymentOption4",
            [
                new(100, "supplierOpt4Amount100", "Kalıbın montajlı teslimi ve kalite onayları sonrasında. (+60 GÜN)", 60),
            ]),
        new(
            "supplierPaymentOption5",
            [
                new(100, "supplierOpt5Amount100", "Parça tesliminde, (+60 GÜN)", 60),
            ]),
    ];

    public void SyncFromFormData(Contract contract)
    {
        var desiredMilestones = BuildDesiredMilestones(contract);

        if (desiredMilestones is null)
        {
            return;
        }

        var existingByTrackingKey = contract.Milestones
            .ToDictionary(milestone => milestone.TrackingKey);
        var desiredTrackingKeys = desiredMilestones
            .Select(milestone => milestone.TrackingKey)
            .ToHashSet();

        foreach (var desiredMilestone in desiredMilestones)
        {
            if (existingByTrackingKey.TryGetValue(
                desiredMilestone.TrackingKey,
                out var existingMilestone))
            {
                ApplyDesiredMilestone(existingMilestone, desiredMilestone);
                EnsurePendingTracking(existingMilestone);
                continue;
            }

            var newMilestone = new ContractMilestone
            {
                Contract = contract,
            };

            ApplyDesiredMilestone(newMilestone, desiredMilestone);
            EnsurePendingTracking(newMilestone);
            contract.Milestones.Add(newMilestone);
        }

        var removableMilestones = contract.Milestones
            .Where(milestone =>
                !desiredTrackingKeys.Contains(milestone.TrackingKey) &&
                !HasMeaningfulPaymentTracking(milestone.PaymentTracking))
            .ToList();

        foreach (var removableMilestone in removableMilestones)
        {
            contract.Milestones.Remove(removableMilestone);
        }
    }

    private static IReadOnlyList<DesiredMilestone>? BuildDesiredMilestones(Contract contract)
    {
        if (string.IsNullOrWhiteSpace(contract.FormDataJson))
        {
            return null;
        }

        JsonDocument document;

        try
        {
            document = JsonDocument.Parse(contract.FormDataJson);
        }
        catch (JsonException)
        {
            return null;
        }

        using (document)
        {
            var root = document.RootElement;

            return contract.FinanceTab == FinanceTabs.Customer
                ? BuildCustomerMilestones(root, contract.TotalAmount)
                : BuildSupplierMilestones(root, contract.TotalAmount, contract.MoldCount);
        }
    }

    private static IReadOnlyList<DesiredMilestone> BuildCustomerMilestones(
        JsonElement root,
        decimal totalAmount)
    {
        var milestones = new List<DesiredMilestone>();

        for (var index = 1; index <= 4; index++)
        {
            var rate = GetDecimal(root, $"customerPaymentRate{index}") ?? 0;
            var condition = GetString(root, $"customerPaymentCondition{index}");
            var dueDays = GetInt(root, $"customerPaymentDueDays{index}") ?? 0;
            var amount = totalAmount > 0 ? totalAmount * rate / 100 : 0;
            var milestoneIndex = index - 1;

            milestones.Add(new DesiredMilestone(
                $"h_{milestoneIndex}",
                milestoneIndex,
                null,
                condition,
                null,
                rate,
                amount,
                dueDays,
                milestoneIndex));
        }

        return milestones;
    }

    private static IReadOnlyList<DesiredMilestone> BuildSupplierMilestones(
        JsonElement root,
        decimal totalAmount,
        int moldCount)
    {
        var milestones = new List<DesiredMilestone>();
        var milestoneIndex = 0;
        var sortOrder = 0;

        foreach (var option in SupplierPaymentOptions)
        {
            if (!GetBool(root, option.OptionName))
            {
                continue;
            }

            for (var rowIndex = 0; rowIndex < option.Rows.Length; rowIndex++)
            {
                var row = option.Rows[rowIndex];
                var amount = GetDecimal(root, row.AmountField)
                    ?? (totalAmount > 0 ? totalAmount * row.Rate / 100 : 0);

                if (rowIndex == 0 && moldCount > 1)
                {
                    for (var subIndex = 0; subIndex < moldCount; subIndex++)
                    {
                        var subAmount = GetMoldAmount(root, option.OptionName, subIndex)
                            ?? amount / moldCount;

                        milestones.Add(new DesiredMilestone(
                            $"h_{milestoneIndex}_alt_{subIndex}",
                            milestoneIndex,
                            subIndex,
                            row.Condition,
                            $"{subIndex + 1}. Kalıp",
                            row.Rate,
                            subAmount,
                            row.DueDays,
                            sortOrder++));
                    }
                }
                else
                {
                    milestones.Add(new DesiredMilestone(
                        $"h_{milestoneIndex}",
                        milestoneIndex,
                        null,
                        row.Condition,
                        null,
                        row.Rate,
                        amount,
                        row.DueDays,
                        sortOrder++));
                }

                milestoneIndex++;
            }
        }

        return milestones;
    }

    private static void ApplyDesiredMilestone(
        ContractMilestone milestone,
        DesiredMilestone desiredMilestone)
    {
        milestone.TrackingKey = desiredMilestone.TrackingKey;
        milestone.MilestoneIndex = desiredMilestone.MilestoneIndex;
        milestone.SubMilestoneIndex = desiredMilestone.SubMilestoneIndex;
        milestone.Condition = NormalizeOptional(desiredMilestone.Condition);
        milestone.SubMilestoneName = NormalizeOptional(desiredMilestone.SubMilestoneName);
        milestone.Rate = desiredMilestone.Rate;
        milestone.Amount = desiredMilestone.Amount;
        milestone.DueDays = desiredMilestone.DueDays;
        milestone.SortOrder = desiredMilestone.SortOrder;
    }

    private static void EnsurePendingTracking(ContractMilestone milestone)
    {
        milestone.PaymentTracking ??= new PaymentTracking
        {
            ContractMilestone = milestone,
            Status = PaymentStatuses.Pending,
        };
    }

    private static bool HasMeaningfulPaymentTracking(PaymentTracking? tracking)
    {
        return tracking is not null &&
            (tracking.Status == PaymentStatuses.Paid ||
            tracking.ApprovalDate.HasValue ||
            tracking.PaymentDate.HasValue ||
            tracking.DueDaysOverride.HasValue);
    }

    private static string? GetString(JsonElement root, string propertyName)
    {
        if (!root.TryGetProperty(propertyName, out var property))
        {
            return null;
        }

        return property.ValueKind switch
        {
            JsonValueKind.String => property.GetString(),
            JsonValueKind.Number => property.GetRawText(),
            _ => null,
        };
    }

    private static int? GetInt(JsonElement root, string propertyName)
    {
        var value = GetString(root, propertyName);

        return int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var result)
            ? result
            : null;
    }

    private static decimal? GetDecimal(JsonElement root, string propertyName)
    {
        var value = GetString(root, propertyName);

        return ParseDecimal(value);
    }

    private static decimal? GetMoldAmount(JsonElement root, string optionName, int subIndex)
    {
        if (!root.TryGetProperty("moldAmounts", out var moldAmounts) ||
            moldAmounts.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var fieldName = $"{optionName}_{subIndex}";

        return moldAmounts.TryGetProperty(fieldName, out var amount)
            ? ParseDecimal(GetElementValue(amount))
            : null;
    }

    private static bool GetBool(JsonElement root, string propertyName)
    {
        if (!root.TryGetProperty(propertyName, out var property))
        {
            return false;
        }

        return property.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String => bool.TryParse(property.GetString(), out var result) && result,
            _ => false,
        };
    }

    private static decimal? ParseDecimal(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalizedValue = value.Trim().Replace(".", string.Empty).Replace(",", ".");

        return decimal.TryParse(
            normalizedValue,
            NumberStyles.Number,
            CultureInfo.InvariantCulture,
            out var result)
            ? result
            : null;
    }

    private static string? GetElementValue(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Number => element.GetRawText(),
            _ => null,
        };
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private sealed record DesiredMilestone(
        string TrackingKey,
        int MilestoneIndex,
        int? SubMilestoneIndex,
        string? Condition,
        string? SubMilestoneName,
        decimal? Rate,
        decimal Amount,
        int DueDays,
        int SortOrder);

    private sealed record SupplierPaymentOption(
        string OptionName,
        SupplierPaymentRow[] Rows);

    private sealed record SupplierPaymentRow(
        decimal Rate,
        string AmountField,
        string Condition,
        int DueDays);
}
