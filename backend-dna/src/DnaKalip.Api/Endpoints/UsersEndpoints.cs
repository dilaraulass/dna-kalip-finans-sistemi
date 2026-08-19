using System.Security.Claims;
using System.Text.RegularExpressions;
using DnaKalip.Api.Data;
using DnaKalip.Api.Domain;
using DnaKalip.Api.Dtos.Users;
using DnaKalip.Api.Entities;
using DnaKalip.Api.Services.Security;
using Microsoft.EntityFrameworkCore;

namespace DnaKalip.Api.Endpoints;

public static class UsersEndpoints
{
    public static IEndpointRouteBuilder MapUsersEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users")
            .RequireAuthorization(AuthPolicies.AdminOnly)
            .WithTags("Users");

        group.MapGet(string.Empty, async (
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var users = await db.AppUsers
                .AsNoTracking()
                .Include(user => user.UserRoles)
                .ThenInclude(userRole => userRole.Role)
                .OrderBy(user => user.FullName)
                .ToListAsync(cancellationToken);

            return Results.Ok(users.Select(ToUserResponse));
        })
        .WithName("GetUsers");

        group.MapPost(string.Empty, async (
            CreateUserRequest request,
            DnaKalipDbContext db,
            PasswordHasher passwordHasher,
            CancellationToken cancellationToken) =>
        {
            var validationErrors = ValidateCreateUserRequest(request);

            if (validationErrors.Count > 0)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var normalizedEmail = NormalizeEmail(request.Email);
            var emailExists = await db.AppUsers
                .AnyAsync(user => user.NormalizedEmail == normalizedEmail, cancellationToken);

            if (emailExists)
            {
                return Results.Conflict(new
                {
                    message = "Bu e-posta adresiyle kullanıcı zaten var.",
                });
            }

            var role = await db.AppRoles
                .FirstOrDefaultAsync(
                    item => item.Name == request.RoleName!.Trim(),
                    cancellationToken);

            if (role is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["roleName"] = ["Seçilen rol bulunamadı."],
                });
            }

            var user = new AppUser
            {
                FullName = request.FullName!.Trim(),
                Email = request.Email!.Trim(),
                NormalizedEmail = normalizedEmail,
                PasswordHash = passwordHasher.Hash(request.Password!.Trim()),
                IsActive = request.IsActive,
            };

            db.AppUsers.Add(user);
            db.AppUserRoles.Add(new AppUserRole
            {
                User = user,
                Role = role,
            });

            await db.SaveChangesAsync(cancellationToken);

            return Results.Created($"/api/users/{user.Id}", ToUserResponse(user, role));
        })
        .WithName("CreateUser");

        group.MapPut("/{id:guid}", async (
            Guid id,
            UpdateUserRequest request,
            ClaimsPrincipal principal,
            DnaKalipDbContext db,
            PasswordHasher passwordHasher,
            CancellationToken cancellationToken) =>
        {
            var validationErrors = ValidateUpdateUserRequest(request);

            if (validationErrors.Count > 0)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var user = await db.AppUsers
                .Include(item => item.UserRoles)
                .ThenInclude(userRole => userRole.Role)
                .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

            if (user is null)
            {
                return Results.NotFound();
            }

            var normalizedEmail = NormalizeEmail(request.Email);
            var emailExists = await db.AppUsers
                .AnyAsync(
                    item => item.Id != id && item.NormalizedEmail == normalizedEmail,
                    cancellationToken);

            if (emailExists)
            {
                return Results.Conflict(new
                {
                    message = "Bu e-posta adresiyle başka bir kullanıcı zaten var.",
                });
            }

            var role = await db.AppRoles
                .FirstOrDefaultAsync(
                    item => item.Name == request.RoleName!.Trim(),
                    cancellationToken);

            if (role is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["roleName"] = ["Seçilen rol bulunamadı."],
                });
            }

            var wouldRemoveAdminAccess =
                user.UserRoles.Any(userRole => userRole.Role.Name == AppRoles.Admin) &&
                (role.Name != AppRoles.Admin || !request.IsActive);

            if (wouldRemoveAdminAccess &&
                await IsLastActiveAdminAsync(db, user.Id, cancellationToken))
            {
                return Results.Conflict(new
                {
                    message = "Son aktif admin kullanıcısı pasifleştirilemez veya muhasebe rolüne alınamaz.",
                });
            }

            user.FullName = request.FullName!.Trim();
            user.Email = request.Email!.Trim();
            user.NormalizedEmail = normalizedEmail;
            user.IsActive = request.IsActive;
            user.UpdatedAt = DateTime.UtcNow;

            if (!string.IsNullOrWhiteSpace(request.NewPassword))
            {
                user.PasswordHash = passwordHasher.Hash(request.NewPassword.Trim());
            }

            db.AppUserRoles.RemoveRange(user.UserRoles);
            db.AppUserRoles.Add(new AppUserRole
            {
                UserId = user.Id,
                RoleId = role.Id,
            });

            await db.SaveChangesAsync(cancellationToken);

            return Results.Ok(ToUserResponse(user, role));
        })
        .WithName("UpdateUser");

        return app;
    }

    private static UserListItemResponse ToUserResponse(AppUser user)
    {
        var role = user.UserRoles
            .Select(userRole => userRole.Role)
            .OrderBy(item => item.Name == AppRoles.Admin ? 0 : 1)
            .FirstOrDefault();

        return ToUserResponse(user, role);
    }

    private static UserListItemResponse ToUserResponse(AppUser user, AppRole? role)
    {
        return new UserListItemResponse(
            user.Id,
            user.FullName,
            user.Email,
            role?.Name ?? string.Empty,
            role?.DisplayName ?? string.Empty,
            user.IsActive,
            user.CreatedAt,
            user.UpdatedAt);
    }

    private static async Task<bool> IsLastActiveAdminAsync(
        DnaKalipDbContext db,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var activeAdminCount = await db.AppUsers
            .Where(user => user.IsActive)
            .Where(user => user.UserRoles.Any(userRole => userRole.Role.Name == AppRoles.Admin))
            .CountAsync(cancellationToken);

        var targetIsActiveAdmin = await db.AppUsers
            .Where(user => user.Id == userId && user.IsActive)
            .AnyAsync(
                user => user.UserRoles.Any(userRole => userRole.Role.Name == AppRoles.Admin),
                cancellationToken);

        return targetIsActiveAdmin && activeAdminCount <= 1;
    }

    private static Dictionary<string, string[]> ValidateCreateUserRequest(
        CreateUserRequest request)
    {
        var errors = ValidateBaseUserRequest(
            request.FullName,
            request.Email,
            request.RoleName);

        AddErrorIf(
            errors,
            string.IsNullOrWhiteSpace(request.Password),
            "password",
            "Şifre zorunludur.");

        return errors;
    }

    private static Dictionary<string, string[]> ValidateUpdateUserRequest(
        UpdateUserRequest request)
    {
        var errors = ValidateBaseUserRequest(
            request.FullName,
            request.Email,
            request.RoleName);

        return errors;
    }

    private static Dictionary<string, string[]> ValidateBaseUserRequest(
        string? fullName,
        string? email,
        string? roleName)
    {
        var errors = new Dictionary<string, string[]>();
        var normalizedRoleName = roleName?.Trim();

        AddErrorIf(errors, string.IsNullOrWhiteSpace(fullName), "fullName", "Ad soyad zorunludur.");
        AddErrorIf(errors, string.IsNullOrWhiteSpace(email), "email", "E-posta zorunludur.");
        AddErrorIf(
            errors,
            !string.IsNullOrWhiteSpace(email) && !IsValidEmail(email.Trim()),
            "email",
            "E-posta formatı geçerli olmalıdır.");
        AddErrorIf(errors, string.IsNullOrWhiteSpace(roleName), "roleName", "Rol zorunludur.");
        AddErrorIf(
            errors,
            !string.IsNullOrWhiteSpace(normalizedRoleName) &&
                !AppRoles.All.Contains(normalizedRoleName),
            "roleName",
            "Rol Admin veya Accounting olmalıdır.");

        return errors;
    }

    private static string NormalizeEmail(string? value)
    {
        return value?.Trim().ToUpperInvariant() ?? string.Empty;
    }

    private static bool IsValidEmail(string value)
    {
        return Regex.IsMatch(
            value,
            @"^[^@\s]+@[^@\s]+\.[^@\s]+$",
            RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));
    }

    private static void AddErrorIf(
        Dictionary<string, string[]> errors,
        bool condition,
        string field,
        string message)
    {
        if (condition)
        {
            errors[field] = [message];
        }
    }
}
