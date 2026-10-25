using System.Security.Claims;

namespace DnaKalip.Api.Domain;

public static class Permissions
{
    public const string ClaimType = "permission";
    public const string FinanceView = "finance.view";
    public const string FinanceEdit = "finance.edit";
    public const string ContractsView = "contracts.view";
    public const string ContractsEdit = "contracts.edit";
    public const string MilestonesApprove = "milestones.approve";
    public const string PaymentsEdit = "payments.edit";
    public const string ExpensesEdit = "expenses.edit";
    public const string Export = "documents.export";
    public static readonly Dictionary<string, string> Catalog = new()
    {
        [FinanceView] = "Finansal tutarları görüntüle",
        [FinanceEdit] = "Sözleşme finansal bilgilerini düzenle ve aktifleştir",
        [ContractsView] = "Sözleşmeleri görüntüle",
        [ContractsEdit] = "Sözleşme hazırla ve düzenle",
        [MilestonesApprove] = "Hakediş onayını ve vadesini güncelle",
        [PaymentsEdit] = "Ödeme, tahsilat ve fatura takibini güncelle",
        [ExpensesEdit] = "Ek gider faturalarını ve kurları yönet",
        [Export] = "Excel / PDF çıktısı al",
    };
    public static bool Has(this ClaimsPrincipal user, string permission) =>
        user.IsInRole(AppRoles.Admin) || user.HasClaim(ClaimType, permission);

    public static string[] Effective(IEnumerable<AppPermissionValue> roleValues, IEnumerable<AppPermissionValue> overrides, bool admin)
    {
        if (admin) return Catalog.Keys.ToArray();
        var result = roleValues.Where(p => p.Allowed).Select(p => p.Code).ToHashSet();
        foreach (var item in overrides)
            if (item.Allowed) result.Add(item.Code); else result.Remove(item.Code);
        return result.Where(Catalog.ContainsKey).Order().ToArray();
    }
}

public record AppPermissionValue(string Code, bool Allowed);
