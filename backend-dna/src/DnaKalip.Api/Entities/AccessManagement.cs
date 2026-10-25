namespace DnaKalip.Api.Entities;

public class RolePermission
{
    public Guid RoleId { get; set; }
    public string Code { get; set; } = string.Empty;
    public AppRole Role { get; set; } = null!;
}

public class UserPermission
{
    public Guid UserId { get; set; }
    public string Code { get; set; } = string.Empty;
    public bool Allowed { get; set; }
    public AppUser User { get; set; } = null!;
}

public class AccessAudit
{
    public long Id { get; set; }
    public Guid ActorId { get; set; }
    public string Action { get; set; } = string.Empty;
    public Guid TargetId { get; set; }
    public string Details { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class UserNotification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid ContractId { get; set; }
    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
