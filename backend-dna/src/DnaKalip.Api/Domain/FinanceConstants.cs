namespace DnaKalip.Api.Domain;

public static class FinanceTabs
{
    public const string Customer = "musteri";
    public const string Supplier = "tedarikci";
}

public static class PaymentStatuses
{
    public const string Pending = "pending";
    public const string Paid = "paid";
}

public static class FinanceStatusKeys
{
    public const string Pending = "pending";
    public const string Paid = "paid";
    public const string Approaching = "approaching";
    public const string Overdue = "overdue";
}

public static class FinanceStatusLabels
{
    public const string Pending = "Bekleyen";
    public const string Paid = "Ödenen";
    public const string Approaching = "Yaklaşan";
    public const string Overdue = "Geciken";
}

public static class Currencies
{
    public const string Try = "TRY";
    public const string Eur = "EUR";
    public const string Usd = "USD";
    public const string LegacyTry = "TL";
}

public static class ExchangeRateTypes
{
    public const string Fixed = "fixed";
    public const string Current = "current";
    public const string FixedTurkish = "sabit";
    public const string CurrentTurkish = "guncel";
    public const string CurrentTurkishWithAccent = "güncel";
}
