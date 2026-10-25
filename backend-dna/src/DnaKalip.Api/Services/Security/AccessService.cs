using System.Security.Claims;
using DnaKalip.Api.Data;
using DnaKalip.Api.Domain;
using DnaKalip.Api.Entities;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

namespace DnaKalip.Api.Services.Security;

public class AccessService(DnaKalipDbContext db)
{
    public static string[] Effective(AppUser user) => Permissions.Effective(
        user.UserRoles.SelectMany(r => r.Role.Permissions).Select(p => new AppPermissionValue(p.Code, true)),
        user.PermissionOverrides.Select(p => new AppPermissionValue(p.Code, p.Allowed)),
        user.UserRoles.Any(r => r.Role.Name == AppRoles.Admin));

    public Task<AppUser?> Load(Guid id, CancellationToken ct) => db.AppUsers.AsNoTracking()
        .Include(u => u.UserRoles).ThenInclude(r => r.Role).ThenInclude(r => r.Permissions)
        .Include(u => u.PermissionOverrides).FirstOrDefaultAsync(u => u.Id == id && u.IsActive, ct);

    public static ClaimsPrincipal Principal(AppUser user)
    {
        var claims = new List<Claim> {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()), new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Email, user.Email),
        };
        claims.AddRange(user.UserRoles.Select(r => new Claim(ClaimTypes.Role, r.Role.Name)));
        claims.AddRange(Effective(user).Select(p => new Claim(Permissions.ClaimType, p)));
        return new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme));
    }

    public async Task ValidateCookie(CookieValidatePrincipalContext context)
    {
        if (!Guid.TryParse(context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id))
        { context.RejectPrincipal(); return; }
        var user = await Load(id, context.HttpContext.RequestAborted);
        if (user is null) { context.RejectPrincipal(); return; }
        // Read current grants on every request; stale cookies cannot retain removed permissions.
        context.ReplacePrincipal(Principal(user));
    }

    public void Audit(ClaimsPrincipal actor, string action, Guid target, object details) => db.AccessAudits.Add(new AccessAudit
    {
        ActorId = Guid.Parse(actor.FindFirstValue(ClaimTypes.NameIdentifier)!),
        Action = action, TargetId = target, Details = System.Text.Json.JsonSerializer.Serialize(details),
    });
}
