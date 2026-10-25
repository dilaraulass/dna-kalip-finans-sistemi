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
                .ThenInclude(role => role.Permissions)
                .Include(user => user.PermissionOverrides)
                .OrderBy(user => user.FullName)
                .ToListAsync(cancellationToken);

            return Results.Ok(users.Select(ToUserResponse));
        })
        .WithName("GetUsers");

        group.MapPost(string.Empty, async (
            CreateUserRequest request,
            ClaimsPrincipal principal,
            AccessService access,
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
                .Include(item => item.Permissions)
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

            var permissionError = ValidateGrants(role, request.PermissionOverrides);
            if (permissionError is not null) return Results.BadRequest(new { message = permissionError });

            var user = new AppUser
            {
                FullName = request.FullName!.Trim(),
                Email = request.Email!.Trim(),
                NormalizedEmail = normalizedEmail,
                PasswordHash = passwordHasher.Hash(request.Password!.Trim()),
                IsActive = request.IsActive,
                PermissionOverrides = (request.PermissionOverrides ?? []).Select(p => new UserPermission { Code = p.Key, Allowed = p.Value }).ToList(),
            };

            db.AppUsers.Add(user);
            db.AppUserRoles.Add(new AppUserRole
            {
                User = user,
                Role = role,
            });

            access.Audit(principal, "user.create", user.Id, new { role.Name, request.PermissionOverrides, request.IsActive });
            await db.SaveChangesAsync(cancellationToken);

            return Results.Created($"/api/users/{user.Id}", ToUserResponse(user, role));
        })
        .WithName("CreateUser");

        group.MapPut("/{id:guid}", async (
            Guid id,
            UpdateUserRequest request,
            AccessService access,
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

            await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, cancellationToken);
            var user = await db.AppUsers
                .Include(item => item.UserRoles)
                .ThenInclude(userRole => userRole.Role)
                .ThenInclude(role => role.Permissions)
                .Include(item => item.PermissionOverrides)
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
                .Include(item => item.Permissions)
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

            var permissionError = ValidateGrants(role, request.PermissionOverrides);
            if (permissionError is not null) return Results.BadRequest(new { message = permissionError });

            var wouldRemoveAdminAccess =
                user.UserRoles.Any(userRole => userRole.Role.Name == AppRoles.Admin) &&
                (role.Name != AppRoles.Admin || !request.IsActive);

            if (wouldRemoveAdminAccess &&
                await IsLastActiveAdminAsync(db, user.Id, cancellationToken))
            {
                return Results.Conflict(new
                {
                    message = "Son aktif admin pasifleştirilemez veya admin rolünden çıkarılamaz.",
                });
            }

            user.FullName = request.FullName!.Trim();
            user.Email = request.Email!.Trim();
            user.NormalizedEmail = normalizedEmail;
            user.IsActive = request.IsActive;
            user.UpdatedAt = DateTime.UtcNow;
            var overrides = request.PermissionOverrides ?? [];
            foreach (var item in user.PermissionOverrides.ToList())
            {
                if (overrides.TryGetValue(item.Code, out var allowed)) item.Allowed = allowed;
                else { db.UserPermissions.Remove(item); user.PermissionOverrides.Remove(item); }
            }
            foreach (var item in overrides.Where(p => !user.PermissionOverrides.Any(old => old.Code == p.Key)))
                user.PermissionOverrides.Add(new UserPermission { UserId = user.Id, Code = item.Key, Allowed = item.Value });

            if (!string.IsNullOrWhiteSpace(request.NewPassword))
            {
                user.PasswordHash = passwordHasher.Hash(request.NewPassword.Trim());
            }

            db.AppUserRoles.RemoveRange(user.UserRoles.Where(item => item.RoleId != role.Id));
            if (!user.UserRoles.Any(item => item.RoleId == role.Id))
                db.AppUserRoles.Add(new AppUserRole
            {
                UserId = user.Id,
                RoleId = role.Id,
            });

            access.Audit(principal, "user.update", user.Id, new { role.Name, request.PermissionOverrides, request.IsActive, PasswordReset = !string.IsNullOrWhiteSpace(request.NewPassword) });
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return Results.Ok(ToUserResponse(user, role));
        })
        .WithName("UpdateUser");

        var roles = app.MapGroup("/api/roles").RequireAuthorization(AuthPolicies.AdminOnly).WithTags("Users");
        roles.MapGet("", async (DnaKalipDbContext db, CancellationToken ct) => Results.Ok(new
        {
            permissions = Permissions.Catalog.Select(p => new { code = p.Key, label = p.Value }),
            roles = await db.AppRoles.AsNoTracking().OrderBy(r => r.DisplayName)
                .Select(r => new { r.Id, r.Name, r.DisplayName, permissions = r.Permissions.Select(p => p.Code).ToArray() }).ToListAsync(ct),
        }));
        roles.MapPost("", async (SaveRoleRequest request, DnaKalipDbContext db, ClaimsPrincipal principal, AccessService access, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.DisplayName) || request.DisplayName.Trim().Length > 100 || request.Permissions is null || request.Permissions.Any(p => !Permissions.Catalog.ContainsKey(p)))
                return Results.BadRequest(new { message = "Rol adı ve yetkiler geçerli olmalıdır." });
            if (await db.AppRoles.AnyAsync(r => r.DisplayName == request.DisplayName.Trim(), ct))
                return Results.Conflict(new { message = "Bu rol adı zaten kullanılıyor." });
            var role = new AppRole { Name = "Custom_" + Guid.NewGuid().ToString("N"), DisplayName = request.DisplayName.Trim() };
            role.Permissions = request.Permissions.Distinct().Select(p => new RolePermission { RoleId = role.Id, Code = p }).ToList();
            var error = ValidateGrants(role, null);
            if (error is not null) return Results.BadRequest(new { message = error });
            db.AppRoles.Add(role);
            access.Audit(principal, "role.create", role.Id, new { role.DisplayName, request.Permissions });
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/roles/{role.Id}", new { role.Id, role.Name, role.DisplayName });
        });
        roles.MapPut("/{id:guid}", async (Guid id, SaveRoleRequest request, DnaKalipDbContext db, ClaimsPrincipal principal, AccessService access, CancellationToken ct) =>
        {
            var role = await db.AppRoles.Include(r => r.Permissions).FirstOrDefaultAsync(r => r.Id == id, ct);
            if (role is null) return Results.NotFound();
            if (role.Name == AppRoles.Admin) return Results.BadRequest(new { message = "Admin rolü değiştirilemez." });
            if (string.IsNullOrWhiteSpace(request.DisplayName) || request.DisplayName.Trim().Length > 100 || request.Permissions is null || request.Permissions.Any(p => !Permissions.Catalog.ContainsKey(p)))
                return Results.BadRequest(new { message = "Rol adı ve yetkiler geçerli olmalıdır." });
            if (await db.AppRoles.AnyAsync(r => r.Id != id && r.DisplayName == request.DisplayName.Trim(), ct))
                return Results.Conflict(new { message = "Bu rol adı zaten kullanılıyor." });
            var proposed = new AppRole { Name = role.Name, Permissions = request.Permissions.Distinct().Select(p => new RolePermission { Code = p }).ToList() };
            var error = ValidateGrants(proposed, null);
            if (error is not null) return Results.BadRequest(new { message = error });
            var members = await db.AppUsers.Include(u => u.PermissionOverrides).Where(u => u.UserRoles.Any(r => r.RoleId == id)).ToListAsync(ct);
            if (members.Any(u => ValidateGrants(proposed, u.PermissionOverrides.ToDictionary(p => p.Code, p => p.Allowed)) is not null))
                return Results.Conflict(new { message = "Bazı kullanıcı istisnaları bu değişiklikle uyumsuz. Önce kullanıcı yetkilerini düzenleyin." });
            var desired = request.Permissions.ToHashSet();
            db.RolePermissions.RemoveRange(role.Permissions.Where(p => !desired.Contains(p.Code)));
            foreach (var code in desired.Except(role.Permissions.Select(p => p.Code))) db.RolePermissions.Add(new RolePermission { RoleId = id, Code = code });
            role.DisplayName = request.DisplayName.Trim();
            access.Audit(principal, "role.update", id, new { role.DisplayName, request.Permissions });
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
        group.MapUserActivities();
        group.MapGet("/audit", async (DnaKalipDbContext db, CancellationToken ct) =>
            Results.Ok(await db.AccessAudits.AsNoTracking().OrderByDescending(a => a.Id).Take(100).ToListAsync(ct)));
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
            user.UpdatedAt,
            user.PermissionOverrides.ToDictionary(p => p.Code, p => p.Allowed),
            Permissions.Effective(role?.Permissions.Select(p => new AppPermissionValue(p.Code, true)) ?? [],
                user.PermissionOverrides.Select(p => new AppPermissionValue(p.Code, p.Allowed)), role?.Name == AppRoles.Admin));
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

        return errors;
    }

    private static string NormalizeEmail(string? value)
    {
        return value?.Trim().ToUpperInvariant() ?? string.Empty;
    }

    private static string? ValidateGrants(AppRole role, Dictionary<string, bool>? overrides)
    {
        if (overrides?.Keys.Any(p => !Permissions.Catalog.ContainsKey(p)) == true) return "Bilinmeyen yetki.";
        if (role.Name == AppRoles.Admin && overrides?.Count > 0) return "Admin için istisna tanımlanamaz.";
        var grants = Permissions.Effective(role.Permissions.Select(p => new AppPermissionValue(p.Code, true)),
            (overrides ?? []).Select(p => new AppPermissionValue(p.Key, p.Value)), role.Name == AppRoles.Admin).ToHashSet();
        if (grants.Contains(Permissions.ContractsEdit) && !grants.Contains(Permissions.ContractsView)) return "Sözleşme hazırlamak için görüntüleme yetkisi gerekir.";
        if (grants.Contains(Permissions.FinanceEdit) && (!grants.Contains(Permissions.FinanceView) || !grants.Contains(Permissions.ContractsEdit))) return "Finansal düzenleme için finans görüntüleme ve sözleşme hazırlama yetkileri gerekir.";
        if ((grants.Contains(Permissions.ExpensesEdit) || grants.Contains(Permissions.PaymentsEdit) || grants.Contains(Permissions.Export)) && !grants.Contains(Permissions.FinanceView)) return "Ödeme, gider yönetimi ve çıktı için finans görüntüleme yetkisi gerekir.";
        return null;
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
