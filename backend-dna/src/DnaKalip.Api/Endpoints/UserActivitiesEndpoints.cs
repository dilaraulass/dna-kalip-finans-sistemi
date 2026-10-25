using DnaKalip.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace DnaKalip.Api.Endpoints;

// Mapped inside the existing admin-only users group.
public static class UserActivitiesEndpoints
{
    public static void MapUserActivities(this RouteGroupBuilder group)
    {
        group.MapGet("/activities", async ([AsParameters] ActivityQuery filter,
            DnaKalipDbContext db, CancellationToken ct) =>
        {
            string[] columns = ["actorName", "actionLabel", "createdAt", "contractNumber", "workOrderNumber"];
            if (filter.Page < 0 || filter.Page > 1000000 || filter.PageSize is < 1 or > 100 ||
                !columns.Contains(filter.Sort) || filter.Direction is not ("asc" or "desc") ||
                (filter.From.HasValue && filter.To.HasValue && filter.From >= filter.To) ||
                new[] { filter.ActorName, filter.Action, filter.ContractNumber, filter.WorkOrderNumber }.Any(s => s?.Length > 200))
                return Results.BadRequest(new { message = "Filtre veya sıralama parametreleri geçersiz." });

            var query = from audit in db.AccessAudits.AsNoTracking()
                        join user in db.AppUsers on audit.ActorId equals user.Id into users
                        from user in users.DefaultIfEmpty()
                        select new ActivityRow
                        {
                            Id = audit.Id,
                            ActorName = audit.ActorName ?? (user != null ? user.FullName : "Bilinmeyen kullanıcı"),
                            ActionLabel = audit.Action == "contract.create" ? "Yeni sözleşme" :
                                audit.Action == "contract.update" ? "Sözleşme güncelleme" :
                                audit.Action == "contract.archive" ? "Sözleşme silme" :
                                audit.Action == "contract.restore" ? "Sözleşme geri yükleme" :
                                audit.Action == "contract.submit" ? "Sözleşmeyi tamamlamaya gönderme" :
                                audit.Action == "contract.return" ? "Sözleşmeyi iade etme" :
                                audit.Action == "contract.activate" ? "Sözleşmeyi aktifleştirme" :
                                audit.Action == "milestone.update" ? "Hakediş onayı güncelleme" :
                                audit.Action == "milestone.due-days" ? "Vade güncelleme" :
                                audit.Action == "payment.update" ? "Ödeme takibi güncelleme" :
                                audit.Action == "invoice.update" ? "Fatura bilgileri güncelleme" :
                                audit.Action == "user.create" ? "Kullanıcı oluşturma" :
                                audit.Action == "user.update" ? "Kullanıcı güncelleme" :
                                audit.Action == "role.create" ? "Rol oluşturma" :
                                audit.Action == "role.update" ? "Rol güncelleme" : audit.Action,
                            CreatedAt = audit.CreatedAt,
                            ContractNumber = audit.ContractNumber,
                            WorkOrderNumber = audit.WorkOrderNumber,
                            IsLegacy = audit.ActorName == null,
                        };
            if (!string.IsNullOrWhiteSpace(filter.ActorName)) query = query.Where(a => a.ActorName.Contains(filter.ActorName.Trim()));
            if (!string.IsNullOrWhiteSpace(filter.Action)) query = query.Where(a => a.ActionLabel.Contains(filter.Action.Trim()));
            if (!string.IsNullOrWhiteSpace(filter.ContractNumber)) query = query.Where(a => a.ContractNumber != null && a.ContractNumber.Contains(filter.ContractNumber.Trim()));
            if (!string.IsNullOrWhiteSpace(filter.WorkOrderNumber)) query = query.Where(a => a.WorkOrderNumber != null && a.WorkOrderNumber.Contains(filter.WorkOrderNumber.Trim()));
            if (filter.From.HasValue) query = query.Where(a => a.CreatedAt >= filter.From.Value);
            if (filter.To.HasValue) query = query.Where(a => a.CreatedAt < filter.To.Value);
            var totalCount = await query.CountAsync(ct);
            var descending = filter.Direction == "desc";
            var ordered = filter.Sort switch
            {
                "actorName" => descending ? query.OrderByDescending(a => a.ActorName) : query.OrderBy(a => a.ActorName),
                "actionLabel" => descending ? query.OrderByDescending(a => a.ActionLabel) : query.OrderBy(a => a.ActionLabel),
                "contractNumber" => descending ? query.OrderByDescending(a => a.ContractNumber) : query.OrderBy(a => a.ContractNumber),
                "workOrderNumber" => descending ? query.OrderByDescending(a => a.WorkOrderNumber) : query.OrderBy(a => a.WorkOrderNumber),
                _ => descending ? query.OrderByDescending(a => a.CreatedAt) : query.OrderBy(a => a.CreatedAt),
            };
            ordered = descending ? ordered.ThenByDescending(a => a.Id) : ordered.ThenBy(a => a.Id);
            var items = await ordered.Skip(filter.Page * filter.PageSize).Take(filter.PageSize).ToListAsync(ct);
            return Results.Ok(new { items, totalCount });
        });
    }
}

public sealed record ActivityQuery(string? ActorName = null, string? Action = null,
    string? ContractNumber = null, string? WorkOrderNumber = null,
    DateTimeOffset? From = null, DateTimeOffset? To = null,
    int Page = 0, int PageSize = 25, string Sort = "createdAt", string Direction = "desc");

public sealed class ActivityRow
{
    public long Id { get; set; }
    public string ActorName { get; set; } = "";
    public string ActionLabel { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public string? ContractNumber { get; set; }
    public string? WorkOrderNumber { get; set; }
    public bool IsLegacy { get; set; }
}
