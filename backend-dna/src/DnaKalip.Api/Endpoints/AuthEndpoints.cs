using System.Security.Claims;
using System.Text.RegularExpressions;
using DnaKalip.Api.Data;
using DnaKalip.Api.Domain;
using DnaKalip.Api.Dtos.Auth;
using DnaKalip.Api.Entities;
using DnaKalip.Api.Services.Security;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

namespace DnaKalip.Api.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth")
            .WithTags("Auth");

        group.MapPost("/login", async (
            LoginRequest request,
            HttpContext httpContext,
            DnaKalipDbContext db,
            PasswordHasher passwordHasher,
            CancellationToken cancellationToken) =>
        {
            var validationErrors = ValidateLoginRequest(request);

            if (validationErrors.Count > 0)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var normalizedEmail = NormalizeEmail(request.Email);
            var user = await db.AppUsers
                .Include(item => item.UserRoles)
                .ThenInclude(userRole => userRole.Role)
                .FirstOrDefaultAsync(
                    item => item.NormalizedEmail == normalizedEmail,
                    cancellationToken);

            if (user is null ||
                !user.IsActive ||
                !passwordHasher.Verify(request.Password!.Trim(), user.PasswordHash))
            {
                return Results.Unauthorized();
            }

            var role = GetPrimaryRole(user);

            if (role is null)
            {
                return Results.Unauthorized();
            }

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.Name, user.FullName),
                new(ClaimTypes.Email, user.Email),
                new(ClaimTypes.Role, role.Name),
            };
            var identity = new ClaimsIdentity(
                claims,
                CookieAuthenticationDefaults.AuthenticationScheme);
            var principal = new ClaimsPrincipal(identity);

            await httpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                principal,
                new AuthenticationProperties
                {
                    IsPersistent = true,
                    ExpiresUtc = DateTimeOffset.UtcNow.AddHours(8),
                });

            return Results.Ok(ToCurrentUserResponse(user, role));
        })
        .AllowAnonymous()
        .WithName("Login");

        group.MapPost("/logout", async (HttpContext httpContext) =>
        {
            await httpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);

            return Results.NoContent();
        })
        .WithName("Logout");

        group.MapGet("/me", async (
            ClaimsPrincipal principal,
            DnaKalipDbContext db,
            CancellationToken cancellationToken) =>
        {
            var userIdValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);

            if (!Guid.TryParse(userIdValue, out var userId))
            {
                return Results.Unauthorized();
            }

            var user = await db.AppUsers
                .AsNoTracking()
                .Include(item => item.UserRoles)
                .ThenInclude(userRole => userRole.Role)
                .FirstOrDefaultAsync(
                    item => item.Id == userId && item.IsActive,
                    cancellationToken);

            var role = user is null ? null : GetPrimaryRole(user);

            return user is null || role is null
                ? Results.Unauthorized()
                : Results.Ok(ToCurrentUserResponse(user, role));
        })
        .RequireAuthorization(AuthPolicies.AuthenticatedUser)
        .WithName("GetCurrentUser");

        return app;
    }

    private static Dictionary<string, string[]> ValidateLoginRequest(LoginRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        var email = request.Email?.Trim();

        AddErrorIf(errors, string.IsNullOrWhiteSpace(email), "email", "E-posta zorunludur.");
        AddErrorIf(
            errors,
            !string.IsNullOrWhiteSpace(email) && !IsValidEmail(email),
            "email",
            "E-posta formatı geçerli olmalıdır.");
        AddErrorIf(
            errors,
            string.IsNullOrWhiteSpace(request.Password),
            "password",
            "Şifre zorunludur.");

        return errors;
    }

    private static CurrentUserResponse ToCurrentUserResponse(AppUser user, AppRole role)
    {
        return new CurrentUserResponse(
            user.Id,
            user.FullName,
            user.Email,
            role.Name,
            role.DisplayName);
    }

    private static AppRole? GetPrimaryRole(AppUser user)
    {
        return user.UserRoles
            .Select(userRole => userRole.Role)
            .OrderBy(role => role.Name == AppRoles.Admin ? 0 : 1)
            .FirstOrDefault();
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
