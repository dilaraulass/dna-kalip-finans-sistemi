namespace DnaKalip.Api.Dtos.Finance;

public sealed record UpdatePaymentTrackingRequest(
    DateOnly? ApprovalDate,
    DateOnly? PaymentDate,
    string Status,
    int? DueDaysOverride);
