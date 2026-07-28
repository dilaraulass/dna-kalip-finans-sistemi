namespace DnaKalip.Api.Entities;

public class Contract
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ContractNumber { get; set; } = string.Empty;
    public string FinanceTab { get; set; } = string.Empty;
    public string? ContractType { get; set; }
    public int? ContractYear { get; set; }
    public string? ContractNumberSuffix { get; set; }
    public string? ProjectNumber { get; set; }
    public DateOnly? ContractDate { get; set; }
    public Guid? CompanyId { get; set; }
    public string? CustomerProject { get; set; }
    public string? WorkOrderNumber { get; set; }
    public string? ReferenceNumber { get; set; }
    public string? PartName { get; set; }
    public int MoldCount { get; set; } = 1;
    public decimal TotalAmount { get; set; }
    public string Currency { get; set; } = "EUR";
    public string? ExchangeRateType { get; set; }
    public decimal? FixedExchangeRate { get; set; }
    public string? FormDataJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Company? Company { get; set; }
    public ICollection<ContractMilestone> Milestones { get; set; } = [];
}
