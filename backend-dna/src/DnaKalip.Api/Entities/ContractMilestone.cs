namespace DnaKalip.Api.Entities;

public class ContractMilestone
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ContractId { get; set; }
    public string TrackingKey { get; set; } = string.Empty;
    public int MilestoneIndex { get; set; }
    public int? SubMilestoneIndex { get; set; }
    public string? Condition { get; set; }
    public string? SubMilestoneName { get; set; }
    public decimal? Rate { get; set; }
    public decimal Amount { get; set; }
    public int DueDays { get; set; }
    public int SortOrder { get; set; }

    public Contract Contract { get; set; } = null!;
    public PaymentTracking? PaymentTracking { get; set; }
}
