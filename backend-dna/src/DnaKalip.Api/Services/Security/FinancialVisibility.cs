using System.Text.Json;
using System.Text.Json.Nodes;
using DnaKalip.Api.Domain;

namespace DnaKalip.Api.Services.Security;

public static class FinancialVisibility
{
    // Allowlist: new document fields are not exposed to restricted users by default.
    public static readonly HashSet<string> TechnicalFields = new(StringComparer.Ordinal)
    {
        "contractNumber", "contractType", "contractNumberSuffix", "documentNumber", "revisionDate", "publishDate",
        "financeTab", "companyId", "companyName", "contractDate", "projectNumber", "customerName", "customerProject",
        "workOrderNumber", "referenceNumber", "partName", "moldCount", "partImage", "moldDesignDates", "scope",
        "workMold", "workWeldingFixture", "workControlFixture", "designDeliveryDate", "laserDeliveryDate",
        "subcontractDeliveryDate", "map0DeliveryDate", "offToolDeliveryDate", "sampleApprovalDate",
        "signatureDate", "pageCount", "supplierSignatureName", "customerSignatureName",
        "respProcessDesign", "respMoldDesign", "respMaterialSupply", "respMachining", "respHeatTreatment", "respCoating",
        "respAssembly", "respPressTryout", "respLaserTryout", "respOffToolTryout", "respMeasurement", "respShipment", "respBuyoff",
        "dnaOriginalModel", "dnaTechnicalDrawing", "dnaProcessDesign", "dnaMoldDesign", "dnaRawMaterial", "dnaStandardMaterial", "dnaFixture",
        "docDetailDrawing", "docModelData", "docMoldData", "docMaterialList", "docMeasurementReport", "docCapabilityReport",
        "docCoatingCertificate", "docMaterialCertificate", "docCncData", "docOperationData", "docHeatTreatmentReport",
        "annexTechnicalSpec", "annexSpecialRequests", "annexCustomerSpec", "annexAdministrativeSpec",
    };

    public static string? TechnicalJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        var source = JsonNode.Parse(json) as JsonObject ?? throw new JsonException("Form verisi nesne olmalıdır.");
        var safe = new JsonObject();
        foreach (var field in TechnicalFields)
        {
            if (!source.TryGetPropertyValue(field, out var value)) continue;
            // Only the known date map may contain structured data. Never expose arbitrary nested JSON.
            if (field == "moldDesignDates" && value is JsonObject dates)
            {
                var safeDates = new JsonObject();
                foreach (var pair in dates)
                    if (pair.Value is JsonValue date && date.TryGetValue<string>(out var text) &&
                        (text == "" || DateOnly.TryParseExact(text, "yyyy-MM-dd", out _)))
                        safeDates[pair.Key] = text;
                safe[field] = safeDates;
            }
            else if (value is null or JsonValue) safe[field] = value?.DeepClone();
        }
        return safe.ToJsonString();
    }

    private static readonly HashSet<string> FinancialFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "totalAmount", "amount", "contractAmount", "convertedAmount", "convertedContractAmount", "rate", "milestoneRate",
        "fixedExchangeRate", "exchangeRateType", "rateToTry", "exchangeRates", "invoiceNumber", "invoiceIssued", "invoiceDataConflict",
    };

    public static JsonNode? Redact(JsonNode? node)
    {
        if (node is JsonArray array) { foreach (var child in array) Redact(child); }
        if (node is JsonObject obj)
        {
            foreach (var key in obj.Select(p => p.Key).ToArray())
            {
                if (FinancialFields.Contains(key)) obj[key] = null;
                else if (key.Equals("formDataJson", StringComparison.OrdinalIgnoreCase))
                    obj[key] = TechnicalJson(obj[key]?.GetValue<string>());
                else Redact(obj[key]);
            }
        }
        return node;
    }
}

public class FinancialVisibilityFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        context.HttpContext.Response.Headers.CacheControl = "no-store";
        var result = await next(context);
        if (context.HttpContext.User.Has(Permissions.FinanceView)) return result;
        if (result is not IValueHttpResult value || value.Value is null) return result;
        var status = (result as IStatusCodeHttpResult)?.StatusCode ?? 200;
        if (status >= 400) return result;
        context.HttpContext.Response.Headers.CacheControl = "no-store";
        var node = JsonSerializer.SerializeToNode(value.Value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        return Results.Json(FinancialVisibility.Redact(node), statusCode: status);
    }
}
