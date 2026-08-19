using DnaKalip.Api.Data;
using DnaKalip.Api.Domain;
using DnaKalip.Api.Entities;
using DnaKalip.Api.Services.Security;
using Microsoft.EntityFrameworkCore;

namespace DnaKalip.Api.Services.Development;

public class AuthSeedService(
    DnaKalipDbContext db,
    PasswordHasher passwordHasher,
    IConfiguration configuration)
{
    public async Task<object> SeedDevelopmentAdminAsync(CancellationToken cancellationToken)
    {
        var existingUserCount = await db.AppUsers.CountAsync(cancellationToken);

        if (existingUserCount > 0)
        {
            return new
            {
                created = false,
                message = "Sistemde kullanıcı olduğu için varsayılan admin oluşturulmadı.",
            };
        }

        var adminRole = await db.AppRoles
            .FirstAsync(role => role.Name == AppRoles.Admin, cancellationToken);
        var email = configuration["Auth:SeedAdmin:Email"] ?? "admin@dna.local";
        var password = configuration["Auth:SeedAdmin:Password"] ?? "Admin123!";
        var fullName = configuration["Auth:SeedAdmin:FullName"] ?? "Sistem Admin";
        var user = new AppUser
        {
            FullName = fullName,
            Email = email.Trim(),
            NormalizedEmail = email.Trim().ToUpperInvariant(),
            PasswordHash = passwordHasher.Hash(password),
            IsActive = true,
        };

        db.AppUsers.Add(user);
        db.AppUserRoles.Add(new AppUserRole
        {
            User = user,
            Role = adminRole,
        });

        await db.SaveChangesAsync(cancellationToken);

        return new
        {
            created = true,
            email = user.Email,
            password,
            role = AppRoles.Admin,
        };
    }
}
