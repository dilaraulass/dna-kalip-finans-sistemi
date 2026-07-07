namespace DnaKalip.Api.Entities;

public class ExchangeRate
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Currency { get; set; } = string.Empty;
    public decimal RateToTry { get; set; }
    public DateOnly EffectiveDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
