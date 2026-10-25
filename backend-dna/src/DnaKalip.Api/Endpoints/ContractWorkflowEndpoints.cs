using System.Security.Claims;
using DnaKalip.Api.Data;
using DnaKalip.Api.Domain;
using DnaKalip.Api.Entities;
using DnaKalip.Api.Services.Security;
using Microsoft.EntityFrameworkCore;

namespace DnaKalip.Api.Endpoints;

public record ContractWorkflowRequest(string Version, Guid? AssigneeId = null, string? Reason = null);

public static class ContractWorkflowEndpoints
{
    public static IEndpointRouteBuilder MapContractWorkflowEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/contracts").RequireAuthorization(Permissions.ContractsEdit);
        group.MapGet("/completers", async (DnaKalipDbContext db, CancellationToken ct) =>
        {
            var users = await db.AppUsers.AsNoTracking().Where(u => u.IsActive)
                .Include(u => u.UserRoles).ThenInclude(r => r.Role).ThenInclude(r => r.Permissions)
                .Include(u => u.PermissionOverrides).ToListAsync(ct);
            return Results.Ok(users.Where(u => AccessService.Effective(u).Contains(Permissions.FinanceEdit))
                .OrderBy(u => u.FullName).Select(u => new { u.Id, u.FullName }));
        });
        group.MapPost("/{id:guid}/workflow/{action}", async (Guid id, string action, ContractWorkflowRequest request,
            ClaimsPrincipal principal, DnaKalipDbContext db, AccessService access, CancellationToken ct) =>
        {
            if (action is not ("submit" or "activate" or "return")) return Results.NotFound();
            var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var admin = principal.IsInRole(AppRoles.Admin);
            var contract = await db.Contracts.Include(c => c.Milestones).FirstOrDefaultAsync(c => c.Id == id, ct);
            if (contract is null || (!admin && contract.CreatedByUserId != userId && contract.AssignedToUserId != userId)) return Results.NotFound();
            if (contract.IsArchived || contract.WorkflowStatus == "active") return Results.Conflict(new { message = "Bu sözleşme için bekleyen işlem yok." });
            if (request.Version != Convert.ToBase64String(contract.Version)) return Results.Conflict(new { message = "Sözleşme değişmiş; önce yenileyin." });
            if (action == "submit")
            {
                if (contract.WorkflowStatus != "draft" && !admin) return Results.Conflict(new { message = "Sözleşme zaten tamamlanmayı bekliyor." });
                if (contract.CreatedByUserId != userId && !admin) return Results.Forbid();
                var assignee = request.AssigneeId.HasValue ? await access.Load(request.AssigneeId.Value, ct) : null;
                if (assignee is null || !AccessService.Effective(assignee).Contains(Permissions.FinanceEdit))
                    return Results.BadRequest(new { message = "Aktif ve finansal düzenleme yetkisi olan bir sorumlu seçin." });
                contract.WorkflowStatus = "pending";
                contract.AssignedToUserId = assignee.Id;
                contract.ReturnReason = null;
                db.UserNotifications.Add(new UserNotification { UserId = assignee.Id, ContractId = id,
                    Message = "Finansal bilgileri tamamlanacak bir sözleşme size atandı." });
            }
            else
            {
                if (!principal.Has(Permissions.FinanceEdit)) return Results.Forbid();
                if (contract.WorkflowStatus == "pending" && contract.AssignedToUserId != userId && !admin) return Results.Forbid();
                if (action == "activate")
                {
                    if (contract.TotalAmount <= 0 || contract.Milestones.Count == 0 ||
                        Math.Abs(contract.Milestones.Sum(m => m.Amount) - contract.TotalAmount) > 0.05m)
                        return Results.BadRequest(new { message = "Bedel ve ödeme planını tamamlayın. Hakediş tutarları toplamı sözleşme bedeliyle eşleşmelidir." });
                    contract.WorkflowStatus = "active";
                    contract.ReturnReason = null;
                }
                else
                {
                    if (contract.WorkflowStatus != "pending" || string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length > 1000)
                        return Results.BadRequest(new { message = "Bekleyen sözleşme için 1–1000 karakterlik iade açıklaması girin. Açıklamaya finansal tutar yazmayın." });
                    contract.WorkflowStatus = "draft";
                    contract.ReturnReason = request.Reason.Trim();
                }
                if (contract.CreatedByUserId.HasValue && contract.CreatedByUserId != userId)
                    db.UserNotifications.Add(new UserNotification { UserId = contract.CreatedByUserId.Value, ContractId = id,
                        Message = action == "activate" ? "Hazırladığınız sözleşme tamamlandı." : "Sözleşmeniz düzeltme için geri gönderildi." });
                contract.AssignedToUserId = null;
            }
            access.Audit(principal, "contract." + action, id, new { contract.WorkflowStatus, contract.AssignedToUserId }, contract);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        var notifications = app.MapGroup("/api/notifications").RequireAuthorization(AuthPolicies.AuthenticatedUser);
        notifications.MapGet("", async (ClaimsPrincipal principal, DnaKalipDbContext db, CancellationToken ct) =>
        {
            var id = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
            return Results.Ok(await db.UserNotifications.AsNoTracking().Where(n => n.UserId == id)
                .OrderByDescending(n => n.CreatedAt).Take(100).ToListAsync(ct));
        });
        notifications.MapPatch("/{id:guid}/read", async (Guid id, ClaimsPrincipal principal, DnaKalipDbContext db, CancellationToken ct) =>
        {
            var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var notification = await db.UserNotifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId, ct);
            if (notification is null) return Results.NotFound();
            notification.IsRead = true;
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
        return app;
    }
}
