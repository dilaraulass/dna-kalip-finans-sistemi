namespace DnaKalip.Api.Dtos.Users;

public record CreateUserRequest(
    string? FullName,
    string? Email,
    string? Password,
    string? RoleName,
    bool IsActive = true,
    Dictionary<string, bool>? PermissionOverrides = null);

public record UpdateUserRequest(
    string? FullName,
    string? Email,
    string? RoleName,
    bool IsActive,
    string? NewPassword,
    Dictionary<string, bool>? PermissionOverrides = null);

public record SaveRoleRequest(string DisplayName, string[] Permissions);
