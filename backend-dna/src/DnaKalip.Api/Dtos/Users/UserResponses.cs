namespace DnaKalip.Api.Dtos.Users;

public record UserListItemResponse(
    Guid Id,
    string FullName,
    string Email,
    string RoleName,
    string RoleDisplayName,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt);
