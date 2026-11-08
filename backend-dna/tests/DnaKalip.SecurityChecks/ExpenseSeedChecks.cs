using System.Globalization;
using System.Text.Json;
using DnaKalip.Api.Data;
using DnaKalip.Api.Services.Development;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;

internal static class ExpenseSeedChecks
{
    public static async Task VerifyAsync(DnaKalipDbContext db, string path)
    {
        var builder = WebApplication.CreateBuilder();
        builder.Configuration["SeedData:DatabaseJsonPath"] = path;
        var importer = new JsonSeedService(db, builder.Environment, builder.Configuration);
        using var json = JsonDocument.Parse(await File.ReadAllTextAsync(path));
        var rows = json.RootElement.EnumerateArray().Single(x => x.GetProperty("id").GetString() == "SYSTEM_EXPENSES_DB")
            .GetProperty("faturalar").EnumerateArray().ToArray();
        var first = await importer.SeedFromJsonAsync(default);
        db.ChangeTracker.Clear();
        var stored = (await db.ExpenseInvoices.AsNoTracking().ToListAsync()).ToDictionary(i => i.SourceInvoiceId!);
        if (first.ExpenseInvoicesCreated != rows.Length || rows.Length != stored.Count)
            throw new InvalidDataException("Expense counts did not reconcile.");
        foreach (var row in rows)
        {
            string? Value(string key) => row.TryGetProperty(key, out var v) ? v.ToString() : null;
            var invoice = stored[Value("id")!];
            if (invoice.Amount != decimal.Parse(Value("amount")!, CultureInfo.InvariantCulture) ||
                invoice.Currency != Value("currency") || invoice.Description != Value("desc") ||
                invoice.WorkOrderNumber != Value("isEmri") || invoice.Status != Value("status") ||
                invoice.DueDays != int.Parse(Value("vade")!, CultureInfo.InvariantCulture) ||
                invoice.InvoiceDate.ToString("yyyy-MM-dd") != Value("date") ||
                invoice.PaymentDate?.ToString("yyyy-MM-dd") != NullIfBlank(Value("paymentDate")) ||
                invoice.InvoiceType != NullIfBlank(Value("type")))
                throw new InvalidDataException("Imported expense fields did not reconcile.");
        }
        var second = await importer.SeedFromJsonAsync(default);
        if (second.ExpenseInvoicesCreated != 0 || second.ExpenseInvoicesSkipped != rows.Length ||
            await db.ExpenseInvoices.CountAsync() != rows.Length)
            throw new InvalidDataException("Repeated import changed the expense count.");
        Console.WriteLine($"PASS: {first.ContractsCreated} contracts imported; {rows.Length} expense IDs and fields reconciled; repeat import created 0 expenses.");
    }
    private static string? NullIfBlank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value;
}
