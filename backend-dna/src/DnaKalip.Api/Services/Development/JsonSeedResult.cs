namespace DnaKalip.Api.Services.Development;

public sealed record JsonSeedResult(
    int CompaniesCreated,
    int ContractsCreated,
    int ContractsSkipped,
    int ContractFormDataBackfilled,
    int MilestonesCreated,
    int PaymentTrackingsCreated,
    int ExpenseInvoicesCreated,
    int ExpenseInvoicesSkipped,
    int ExchangeRatesCreated,
    string SourcePath);
