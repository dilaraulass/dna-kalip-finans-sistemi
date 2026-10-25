using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Text.Json.Nodes;
using DnaKalip.Api.Data;
using DnaKalip.Api.Domain;
using DnaKalip.Api.Entities;
using DnaKalip.Api.Services.Security;
using Microsoft.EntityFrameworkCore;

// No additional test packages. Default execution never connects to a database.
var checks = 0;
void Check(bool condition, string name)
{
    if (!condition) throw new InvalidOperationException("FAIL: " + name);
    Console.WriteLine("PASS: " + name); checks++;
}
var grants = Permissions.Effective([new(Permissions.FinanceView, true)],
    [new(Permissions.FinanceView, false), new(Permissions.ContractsEdit, true)], false);
Check(!grants.Contains(Permissions.FinanceView) && grants.Contains(Permissions.ContractsEdit), "User overrides role grants");
Check(Permissions.Effective([], [], true).Length == Permissions.Catalog.Count, "Admin has all grants");
Check(Permissions.Effective([new("unknown", true)], [], false).Length == 0, "Unknown grants are ignored");
var redacted = FinancialVisibility.Redact(JsonNode.Parse("""
{"totalAmount":9876,"milestones":[{"amount":456,"rate":30}],"formDataJson":"{\"partName\":\"Part\",\"totalAmount\":9876,\"moldAmounts\":{\"0\":456},\"futureField\":42}","exchangeRates":{"EUR":80}}
"""))!;
Check(!redacted.ToJsonString().Contains("9876") && !redacted.ToJsonString().Contains("456"), "Amounts removed from response and embedded document");
Check(redacted["exchangeRates"] is null && redacted["milestones"]![0]!["rate"] is null, "Rates removed");
Check(JsonNode.Parse(redacted["formDataJson"]!.GetValue<string>())!["partName"]!.GetValue<string>() == "Part", "Technical data preserved");
Check(!FinancialVisibility.TechnicalJson("{\"partName\":{\"amount\":123},\"moldDesignDates\":{\"0\":\"2026-01-01\",\"1\":\"123 EUR\"}}")!.Contains("123"), "Nested arbitrary document data not exposed");

if (!args.Contains("--integration"))
{
    Console.WriteLine($"{checks} checks passed. Use --integration for isolated SQL/API tests.");
    return;
}

// Generated database only: never accepts an existing database name or connection string.
var databaseName = "DnaKalip_SecurityCheck_" + Guid.NewGuid().ToString("N");
var server = args.FirstOrDefault(a => a.StartsWith("--server="))?[9..] ?? @"localhost\SQL2022";
var connection = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder
{
    DataSource = server, InitialCatalog = databaseName, IntegratedSecurity = true,
    TrustServerCertificate = true, ConnectTimeout = 15,
}.ConnectionString;
var options = new DbContextOptionsBuilder<DnaKalipDbContext>().UseSqlServer(connection).Options;
await using var db = new DnaKalipDbContext(options);
Process? api = null;
var tempRoot = Path.Combine(Path.GetTempPath(), databaseName);
Directory.CreateDirectory(tempRoot);
try
{
    await db.Database.MigrateAsync();
    Check(!(await db.Database.GetPendingMigrationsAsync()).Any(), "All migrations applied on isolated database");
    var adminRole = await db.AppRoles.SingleAsync(r => r.Name == AppRoles.Admin);
    var adminUser = new AppUser { FullName = "Test Admin", Email = "admin@test.local", NormalizedEmail = "ADMIN@TEST.LOCAL",
        PasswordHash = new PasswordHasher().Hash("Test-only-8765"), UserRoles = [new AppUserRole { Role = adminRole }] };
    db.AppUsers.Add(adminUser); await db.SaveChangesAsync();
    var listener = new TcpListener(IPAddress.Loopback, 0); listener.Start();
    var port = ((IPEndPoint)listener.LocalEndpoint).Port; listener.Stop();
    var start = new ProcessStartInfo("dotnet") { WorkingDirectory = tempRoot, UseShellExecute = false, CreateNoWindow = true,
        RedirectStandardOutput = true, RedirectStandardError = true };
    // Project reference copies the real API executable and runtime configuration into this output directory.
    foreach (var arg in new[] { typeof(DnaKalipDbContext).Assembly.Location, "--environment", "Development", "--urls",
        $"http://127.0.0.1:{port}", "--ConnectionStrings:DefaultConnection", connection,
        "--Logging:LogLevel:Default", "Warning" }) start.ArgumentList.Add(arg);
    api = Process.Start(start)!;
    var log = api.StandardOutput.ReadToEndAsync(); var errors = api.StandardError.ReadToEndAsync();
    HttpClient Client() => new(new HttpClientHandler { CookieContainer = new CookieContainer(), AllowAutoRedirect = false })
        { BaseAddress = new Uri($"http://127.0.0.1:{port}"), Timeout = TimeSpan.FromSeconds(30) };
    using var admin = Client(); using var technical = Client(); using var stranger = Client(); using var approver = Client();
    using var anonymous = Client();
    var ready = false;
    for (var i = 0; i < 60; i++)
    {
        if (api.HasExited) throw new Exception(await log + await errors);
        try { ready = (await anonymous.GetAsync("/health")).IsSuccessStatusCode; } catch (HttpRequestException) { }
        if (ready) break; await Task.Delay(250);
    }
    Check(ready, "Real API started on loopback");
    async Task<JsonNode?> Request(HttpClient client, HttpMethod method, string path, object? body, int expected)
    {
        using var request = new HttpRequestMessage(method, path);
        if (body is not null) request.Content = JsonContent.Create(body);
        using var response = await client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        Check((int)response.StatusCode == expected, $"{method} {path} => {expected} (actual {(int)response.StatusCode})" +
            ((int)response.StatusCode != expected ? " " + text[..Math.Min(text.Length, 1500)] : ""));
        if (text.Length == 0) return null;
        return response.Content.Headers.ContentType?.MediaType?.Contains("json") == true
            ? JsonNode.Parse(text) : JsonValue.Create(text);
    }
    async Task Login(HttpClient client, string email) => await Request(client, HttpMethod.Post, "/api/auth/login", new { email, password = "Test-only-8765" }, 200);
    await Request(anonymous, HttpMethod.Get, "/api/contracts", null, 401);
    await Login(admin, adminUser.Email);
    await Request(admin, HttpMethod.Put, $"/api/users/{adminUser.Id}", new { fullName = adminUser.FullName, email = adminUser.Email,
        roleName = "Admin", isActive = false }, 409);
    var role = await Request(admin, HttpMethod.Post, "/api/roles", new { displayName = "Teknik", permissions = new[] { "contracts.view", "contracts.edit", "milestones.approve" } }, 201);
    var roleName = role!["name"]!.GetValue<string>();
    async Task<JsonNode> AddUser(string name, string chosenRole) => (await Request(admin, HttpMethod.Post, "/api/users", new
    { fullName = name, email = name + "@test.local", password = "Test-only-8765", roleName = chosenRole, isActive = true }, 201))!;
    var techUser = await AddUser("technical", roleName);
    await AddUser("stranger", roleName);
    await AddUser("approver", "Accounting");
    await Login(technical, "technical@test.local"); await Login(stranger, "stranger@test.local"); await Login(approver, "approver@test.local");
    await Request(technical, HttpMethod.Get, "/api/users", null, 403);
    await Request(technical, HttpMethod.Post, "/api/roles", new { displayName = "Attack", permissions = new[] { "finance.view" } }, 403);
    await Request(technical, HttpMethod.Get, "/api/finance/exchange-rates", null, 403);
    var payload = new JsonObject { ["contractNumber"] = "TEST-001", ["financeTab"] = "musteri", ["companyName"] = "Test Company",
        ["totalAmount"] = 12345, ["currency"] = "EUR", ["moldCount"] = 1, ["workOrderNumber"] = "WO-TEST-001",
        ["formDataJson"] = "{\"partName\":\"Part\",\"totalAmount\":12345,\"customerPaymentRate1\":100,\"customerPaymentCondition1\":\"Delivery\"}" };
    var contract = (await Request(technical, HttpMethod.Post, "/api/contracts", payload, 201))!;
    var id = contract["id"]!.GetValue<string>(); var path = "/api/contracts/" + id;
    Check(contract["workflowStatus"]!.GetValue<string>() == "draft" && contract["totalAmount"] is null, "Technical creator forced to redacted draft");
    var dashboard = (await Request(admin, HttpMethod.Get, "/api/finance/dashboard", null, 200))!;
    Check(dashboard["paymentMilestones"]!.AsArray().Count == 0, "Drafts excluded from finance");
    await Request(stranger, HttpMethod.Get, path, null, 404);
    await Request(technical, HttpMethod.Post, path + "/workflow/activate", new { version = contract["version"]!.GetValue<string>() }, 403);
    var people = (await Request(technical, HttpMethod.Get, "/api/contracts/completers", null, 200))!.AsArray();
    var assigned = people.Single(p => p!["fullName"]!.GetValue<string>() == "approver")!["id"]!.GetValue<string>();
    await Request(technical, HttpMethod.Post, path + "/workflow/submit", new { version = contract["version"]!.GetValue<string>(), assigneeId = assigned }, 204);
    var notifications = (await Request(approver, HttpMethod.Get, "/api/notifications", null, 200))!.AsArray();
    Check(notifications.Count == 1, "Assigned user notified");
    await Request(stranger, HttpMethod.Patch, "/api/notifications/" + notifications[0]!["id"]!.GetValue<string>() + "/read", null, 404);
    await Request(approver, HttpMethod.Patch, "/api/notifications/" + notifications[0]!["id"]!.GetValue<string>() + "/read", null, 204);
    var pending = (await Request(approver, HttpMethod.Get, path, null, 200))!;
    await Request(approver, HttpMethod.Post, path + "/workflow/activate", new { version = pending["version"]!.GetValue<string>() }, 400);
    payload["version"] = pending["version"]!.DeepClone();
    var updated = (await Request(approver, HttpMethod.Put, path, payload, 200))!;
    await Request(approver, HttpMethod.Put, path, payload, 409); // stale form
    await Request(approver, HttpMethod.Post, path + "/workflow/return", new { version = updated["version"]!.GetValue<string>(), reason = "Teknik alanı düzeltin" }, 204);
    var returned = (await Request(technical, HttpMethod.Get, path, null, 200))!;
    payload["version"] = returned["version"]!.DeepClone(); payload["totalAmount"] = 999999;
    payload["formDataJson"] = "{\"partName\":\"Updated part\",\"totalAmount\":999999}";
    await Request(technical, HttpMethod.Put, path, payload, 200);
    var preserved = (await Request(admin, HttpMethod.Get, path, null, 200))!;
    Check(preserved["totalAmount"]!.GetValue<decimal>() == 12345, "Technical edits preserve protected financial fields");
    await Request(technical, HttpMethod.Post, path + "/workflow/submit", new { version = preserved["version"]!.GetValue<string>(), assigneeId = assigned }, 204);
    pending = (await Request(approver, HttpMethod.Get, path, null, 200))!;
    await Request(approver, HttpMethod.Post, path + "/workflow/activate", new { version = pending["version"]!.GetValue<string>() }, 204);
    dashboard = (await Request(technical, HttpMethod.Get, "/api/finance/dashboard", null, 200))!;
    var milestone = dashboard["paymentMilestones"]![0]!;
    Check(milestone["amount"] is null && milestone["contractAmount"] is null && dashboard["exchangeRates"] is null, "Active finance API masks values");
    var restricted = (await Request(technical, HttpMethod.Get, path, null, 200))!;
    Check(!restricted.ToJsonString().Contains("12345"), "Detail and embedded document do not leak value");
    var companyId = restricted["company"]!["id"]!.GetValue<string>();
    var companyDetail = (await Request(technical, HttpMethod.Get, "/api/companies/" + companyId, null, 200))!;
    Check(companyDetail["contracts"]![0]!["totalAmount"] is null, "Company related contracts mask amounts too");
    var activePayload = payload.DeepClone().AsObject();
    activePayload["contractNumber"] = "TEST-002"; activePayload["totalAmount"] = 12345;
    activePayload["formDataJson"] = "{\"customerPaymentRate1\":100,\"customerPaymentCondition1\":\"Delivery\"}";
    var direct = (await Request(approver, HttpMethod.Post, "/api/contracts", activePayload, 201))!;
    Check(direct["workflowStatus"]!.GetValue<string>() == "active", "Authorized creator activates directly without assignment");
    await Request(technical, HttpMethod.Patch, path + "/archive", null, 403);
    await Request(technical, HttpMethod.Put, "/api/finance/exchange-rates/EUR", new { rateToTry = 99 }, 403);
    await Request(technical, HttpMethod.Post, "/api/expense-invoices", new { }, 403);
    var trackingPath = "/api/contract-milestones/" + milestone["id"]!.GetValue<string>() + "/payment-tracking";
    await Request(technical, HttpMethod.Put, trackingPath, new { approvalDate = "2026-10-25", status = "pending" }, 204);
    await Request(technical, HttpMethod.Put, trackingPath, new { approvalDate = "2026-10-25", paymentDate = "2026-10-26", status = "paid" }, 403);
    var countBeforeNoop = await db.AccessAudits.CountAsync();
    await Request(technical, HttpMethod.Put, trackingPath, new { approvalDate = "2026-10-25", status = "pending" }, 204);
    Check(await db.AccessAudits.CountAsync() == countBeforeNoop, "Unchanged tracking does not create duplicate activities");
    await Request(technical, HttpMethod.Put, trackingPath, new { approvalDate = "2026-10-25", status = "pending", dueDaysOverride = -1 }, 400);
    await Request(technical, HttpMethod.Put, trackingPath, new { approvalDate = "2026-10-25", status = "paid" }, 403);
    Check(await db.AccessAudits.CountAsync() == countBeforeNoop, "Validation and permission failures do not create activities");
    var beforeDueUpdate = DateTimeOffset.UtcNow;
    await Request(technical, HttpMethod.Put, trackingPath, new { approvalDate = "2026-10-25", status = "pending", dueDaysOverride = 45 }, 204);
    var dueAudit = await db.AccessAudits.AsNoTracking().SingleAsync(a => a.Action == "milestone.due-days");
    Check(dueAudit.ActorName == "technical" && dueAudit.ContractNumber == "TEST-001" && dueAudit.WorkOrderNumber == "WO-TEST-001", "Milestone activity captures actor and contract snapshots");
    Check(dueAudit.CreatedAt >= beforeDueUpdate && dueAudit.CreatedAt <= DateTimeOffset.UtcNow, "Activity timestamp is generated by server");
    await Request(admin, HttpMethod.Put, trackingPath, new { approvalDate = "2026-10-25", paymentDate = "2026-10-26",
        status = "paid", dueDaysOverride = 45, invoiceIssued = true, invoiceNumber = "INV-TEST" }, 204);
    Check(await db.AccessAudits.CountAsync(a => a.Action == "payment.update") == 1 &&
        await db.AccessAudits.CountAsync(a => a.Action == "invoice.update") == 1, "Payment and invoice changes create distinct activities");
    var countAfterPayment = await db.AccessAudits.CountAsync();
    await Request(admin, HttpMethod.Put, trackingPath, new { approvalDate = "2026-10-25", paymentDate = "2026-10-26",
        status = "paid", dueDaysOverride = 45, invoiceIssued = true, invoiceNumber = "INV-TEST" }, 204);
    Check(await db.AccessAudits.CountAsync() == countAfterPayment, "Repeated invoice and payment saves do not duplicate activity records");
    // Role grant change must take effect on the existing authentication cookie.
    await Request(admin, HttpMethod.Put, "/api/roles/" + role["id"]!.GetValue<string>(), new { displayName = "Teknik", permissions = new[] { "contracts.view", "contracts.edit" } }, 204);
    await Request(technical, HttpMethod.Put, trackingPath, new { approvalDate = "2026-10-26", status = "pending" }, 403);
    await Request(admin, HttpMethod.Put, "/api/users/" + techUser["id"]!.GetValue<string>(), new { fullName = "technical", email = "technical@test.local", roleName, isActive = true }, 200);
    await Request(admin, HttpMethod.Put, "/api/users/" + techUser["id"]!.GetValue<string>(), new { fullName = "technical", email = "technical@test.local", roleName, isActive = true,
        permissionOverrides = new Dictionary<string, bool> { ["finance.view"] = true } }, 200);
    var permitted = (await Request(technical, HttpMethod.Get, path, null, 200))!;
    Check(permitted["totalAmount"]!.GetValue<decimal>() == 12345, "Per-user permission grants apply to existing cookie");
    await Request(admin, HttpMethod.Put, "/api/users/" + techUser["id"]!.GetValue<string>(), new { fullName = "technical", email = "technical@test.local", roleName, isActive = true,
        permissionOverrides = new Dictionary<string, bool> { ["finance.view"] = false } }, 200);
    var denied = (await Request(technical, HttpMethod.Get, path, null, 200))!;
    Check(denied["totalAmount"] is null, "Per-user permission revocation applies immediately");
    await Request(admin, HttpMethod.Put, "/api/users/" + techUser["id"]!.GetValue<string>(), new { fullName = "technical", email = "technical@test.local", roleName, isActive = false }, 200);
    await Request(technical, HttpMethod.Get, "/api/auth/me", null, 401);
    var audit = (await Request(admin, HttpMethod.Get, "/api/users/audit", null, 200))!.AsArray();
    Check(audit.Count >= 10 && !audit.ToJsonString().Contains("Test-only"), "Audit tracks operations without passwords");

    await Request(anonymous, HttpMethod.Get, "/api/users/activities", null, 401);
    await Request(approver, HttpMethod.Get, "/api/users/activities", null, 403);
    var activities = (await Request(admin, HttpMethod.Get, "/api/users/activities?pageSize=100", null, 200))!;
    var rows = activities["items"]!.AsArray();
    Check(rows.Count == activities["totalCount"]!.GetValue<int>() && rows.Count > 10, "Activities returns paginated data and total count");
    Check(!activities.ToJsonString().Contains("Test-only") && !activities.ToJsonString().Contains("password", StringComparison.OrdinalIgnoreCase), "Public activity DTO excludes sensitive details");
    Check(rows.Any(r => r!["actionLabel"]!.GetValue<string>() == "Yeni sözleşme") && rows.Any(r => r!["actionLabel"]!.GetValue<string>() == "Vade güncelleme"), "Actions have readable Turkish names");
    foreach (var column in new[] { "actorName", "actionLabel", "createdAt", "contractNumber", "workOrderNumber" })
    {
        var ascending = (await Request(admin, HttpMethod.Get, $"/api/users/activities?pageSize=100&sort={column}&direction=asc", null, 200))!["items"]!.AsArray();
        var descending = (await Request(admin, HttpMethod.Get, $"/api/users/activities?pageSize=100&sort={column}&direction=desc", null, 200))!["items"]!.AsArray();
        Check(ascending.Select(r => r!["id"]!.GetValue<long>()).SequenceEqual(descending.Select(r => r!["id"]!.GetValue<long>()).Reverse()), $"{column} sort reverses consistently including ties");
    }
    foreach (var (field, value, resultField) in new[] { ("actorName", "technical", "actorName"), ("action", "Vade", "actionLabel"),
        ("contractNumber", "TEST-001", "contractNumber"), ("workOrderNumber", "WO-TEST-001", "workOrderNumber") })
    {
        var filtered = (await Request(admin, HttpMethod.Get, $"/api/users/activities?pageSize=100&{field}={Uri.EscapeDataString(value)}", null, 200))!["items"]!.AsArray();
        Check(filtered.Count > 0 && filtered.All(r => r![resultField]!.GetValue<string>().Contains(value)), $"{field} filters on server");
    }
    var page0 = (await Request(admin, HttpMethod.Get, "/api/users/activities?pageSize=2&page=0", null, 200))!;
    var page1 = (await Request(admin, HttpMethod.Get, "/api/users/activities?pageSize=2&page=1", null, 200))!;
    Check(page0["items"]!.AsArray().Count == 2 && page1["items"]!.AsArray().Count == 2 &&
        !page0["items"]!.AsArray().Select(r => r!["id"]!.GetValue<long>()).Intersect(page1["items"]!.AsArray().Select(r => r!["id"]!.GetValue<long>())).Any(), "Pagination has no overlapping rows");
    foreach (var invalid in new[] { "page=-1", "pageSize=101", "sort=details", "direction=invalid", "from=invalid", "from=2026-10-26&to=2026-10-25" })
        await Request(admin, HttpMethod.Get, "/api/users/activities?" + invalid, null, 400);

    // Only generated test database is changed. Historical snapshots must survive later renaming.
    await db.AppUsers.Where(u => u.Id == Guid.Parse(techUser["id"]!.GetValue<string>())).ExecuteUpdateAsync(s => s.SetProperty(u => u.FullName, "Renamed technical"));
    await db.Contracts.Where(c => c.Id == Guid.Parse(id)).ExecuteUpdateAsync(s => s.SetProperty(c => c.ContractNumber, "RENAMED").SetProperty(c => c.WorkOrderNumber, "NEW-WORK"));
    var snapshots = (await Request(admin, HttpMethod.Get, "/api/users/activities?contractNumber=TEST-001&actorName=technical&pageSize=100", null, 200))!["items"]!.AsArray();
    Check(snapshots.Count > 0 && snapshots.All(r => r!["actorName"]!.GetValue<string>() == "technical" && r["workOrderNumber"]!.GetValue<string>() == "WO-TEST-001"), "Historical names and numbers survive changes to source records");
    var boundary = DateTimeOffset.Parse("2025-01-01T00:00:00+03:00");
    db.AccessAudits.AddRange(
        new AccessAudit { ActorId = adminUser.Id, ActorName = "date-fixture", Action = "contract.create", CreatedAt = boundary.AddSeconds(-1) },
        new AccessAudit { ActorId = adminUser.Id, ActorName = "date-fixture", Action = "contract.create", CreatedAt = boundary },
        new AccessAudit { ActorId = adminUser.Id, ActorName = "date-fixture", Action = "contract.create", CreatedAt = boundary.AddDays(1).AddSeconds(-1) },
        new AccessAudit { ActorId = adminUser.Id, ActorName = "date-fixture", Action = "contract.create", CreatedAt = boundary.AddDays(1) },
        new AccessAudit { ActorId = adminUser.Id, Action = "user.create" });
    await db.SaveChangesAsync();
    var day = (await Request(admin, HttpMethod.Get, "/api/users/activities?actorName=date-fixture&from=" + Uri.EscapeDataString(boundary.ToString("O")) + "&to=" + Uri.EscapeDataString(boundary.AddDays(1).ToString("O")), null, 200))!;
    Check(day["totalCount"]!.GetValue<int>() == 2, "Date filter is inclusive start and exclusive next day, using explicit timezone");
    var legacy = (await Request(admin, HttpMethod.Get, "/api/users/activities?actorName=Test%20Admin&pageSize=100", null, 200))!["items"]!.AsArray();
    Check(legacy.Any(r => r!["isLegacy"]!.GetValue<bool>() && r["contractNumber"] is null), "Legacy records remain readable without fabricated contract snapshots");
    Console.WriteLine($"{checks} checks passed.");
    if (args.Contains("--browser"))
    {
        Console.WriteLine($"Browser test API: http://127.0.0.1:{port} (isolated database; automatic cleanup in 5 minutes)");
        await Task.Delay(TimeSpan.FromMinutes(5));
    }
}
finally
{
    if (api is { HasExited: false }) { api.Kill(entireProcessTree: true); await api.WaitForExitAsync(); }
    api?.Dispose();
    // Only this run's generated database can be removed. The application's database is never referenced.
    if (db.Database.GetDbConnection().Database == databaseName && databaseName.StartsWith("DnaKalip_SecurityCheck_"))
        await db.Database.EnsureDeletedAsync();
    // Temporary data-protection files are retained in the OS temp directory, never the project's keys.
}
