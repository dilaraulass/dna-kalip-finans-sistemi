using DnaKalip.Api.Data;
using DnaKalip.Api.Domain;
using DnaKalip.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace DnaKalip.Api.Services.Security;

public class InitialAdminSeeder(
    DnaKalipDbContext db,
    PasswordHasher passwordHasher,
    IConfiguration configuration,
    ILogger<InitialAdminSeeder> logger)
{
    public async Task SeedAsync(CancellationToken cancellationToken)
    {
        var enabled = string.Equals(
            configuration["Auth:InitialAdmin:Enabled"],
            "true",
            StringComparison.OrdinalIgnoreCase);

        if (!enabled)
        {
            return;
        }

        var activeAdminExists = await db.AppUsers
            .AnyAsync(
                user =>
                    user.IsActive &&
                    user.UserRoles.Any(userRole => userRole.Role.Name == AppRoles.Admin),
                cancellationToken);

        if (activeAdminExists)
        {
            logger.LogInformation("Initial admin seed skipped because an active admin already exists.");
            return;
        }

        var email = configuration["Auth:InitialAdmin:Email"]?.Trim();
        var password = configuration["Auth:InitialAdmin:Password"]?.Trim();
        var fullName = configuration["Auth:InitialAdmin:FullName"]?.Trim();

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            throw new InvalidOperationException(
                "Initial admin seed is enabled but Auth:InitialAdmin:Email or Auth:InitialAdmin:Password is missing.");
        }

        var normalizedEmail = email.ToUpperInvariant();
        var adminRole = await db.AppRoles
            .FirstAsync(role => role.Name == AppRoles.Admin, cancellationToken);
        var user = await db.AppUsers
            .Include(item => item.UserRoles)
            .FirstOrDefaultAsync(
                item => item.NormalizedEmail == normalizedEmail,
                cancellationToken);

        if (user is null)
        {
            user = new AppUser
            {
                FullName = string.IsNullOrWhiteSpace(fullName) ? "Sistem Admin" : fullName,
                Email = email,
                NormalizedEmail = normalizedEmail,
                PasswordHash = passwordHasher.Hash(password),
                IsActive = true,
            };

            db.AppUsers.Add(user);
        }
        else
        {
            user.FullName = string.IsNullOrWhiteSpace(fullName) ? user.FullName : fullName;
            user.PasswordHash = passwordHasher.Hash(password);
            user.IsActive = true;
            user.UpdatedAt = DateTime.UtcNow;
        }

        if (!user.UserRoles.Any(userRole => userRole.RoleId == adminRole.Id))
        {
            db.AppUserRoles.Add(new AppUserRole
            {
                User = user,
                Role = adminRole,
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Initial admin user created for {Email}.", email);
    }
}
