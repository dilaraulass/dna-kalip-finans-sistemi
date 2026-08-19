namespace DnaKalip.Api.Dtos.Auth;

public record CurrentUserResponse(
    Guid Id,
    string FullName,
    string Email,
    string RoleName,
    string RoleDisplayName);
