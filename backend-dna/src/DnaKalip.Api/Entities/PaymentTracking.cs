namespace DnaKalip.Api.Entities;

public class PaymentTracking
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ContractMilestoneId { get; set; }
    public DateOnly? ApprovalDate { get; set; }
    public DateOnly? PaymentDate { get; set; }
    public string Status { get; set; } = "pending";
    public int? DueDaysOverride { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ContractMilestone ContractMilestone { get; set; } = null!;
}
