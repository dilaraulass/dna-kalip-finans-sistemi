namespace DnaKalip.Api.Entities;

public class AppRole
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;

    public ICollection<AppUserRole> UserRoles { get; set; } = [];
}
