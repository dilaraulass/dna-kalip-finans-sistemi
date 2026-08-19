namespace DnaKalip.Api.Dtos.Users;

public record CreateUserRequest(
    string? FullName,
    string? Email,
    string? Password,
    string? RoleName,
    bool IsActive = true);

public record UpdateUserRequest(
    string? FullName,
    string? Email,
    string? RoleName,
    bool IsActive,
    string? NewPassword);
