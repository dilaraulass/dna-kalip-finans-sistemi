using DnaKalip.Api.Data;
using DnaKalip.Api.Domain;
using DnaKalip.Api.Endpoints;
using DnaKalip.Api.Services.Contracts;
using DnaKalip.Api.Services.Development;
using DnaKalip.Api.Services.Security;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsDevelopment())
{
    builder.Logging.ClearProviders();
    builder.Logging.AddConsole();
}

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddDbContext<DnaKalipDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services
    .AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(
        Path.Combine(builder.Environment.ContentRootPath, "App_Data", "DataProtectionKeys")));
builder.Services.AddScoped<ContractMilestoneSyncService>();
builder.Services.AddScoped<PasswordHasher>();
builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "dna_auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(
        AuthPolicies.AuthenticatedUser,
        policy => policy.RequireAuthenticatedUser());
    options.AddPolicy(
        AuthPolicies.AdminOnly,
        policy => policy.RequireRole(AppRoles.Admin));
});

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddScoped<JsonSeedService>();
    builder.Services.AddScoped<AuthSeedService>();
}

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapPost("/api/dev/seed-from-json", async (
        JsonSeedService seedService,
        CancellationToken cancellationToken) =>
    {
        var result = await seedService.SeedFromJsonAsync(cancellationToken);

        return Results.Ok(result);
    })
    .WithName("SeedFromJson");

    app.MapPost("/api/dev/seed-auth", async (
        AuthSeedService seedService,
        CancellationToken cancellationToken) =>
    {
        var result = await seedService.SeedDevelopmentAdminAsync(cancellationToken);

        return Results.Ok(result);
    })
    .WithName("SeedAuth");
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.MapGet("/health", () => Results.Ok(new
{
    status = "Healthy",
    service = "DnaKalip.Api",
    timestamp = DateTimeOffset.UtcNow,
}))
.WithName("GetHealth");

app.UseAuthentication();
app.UseAuthorization();

app.MapAuthEndpoints();
app.MapUsersEndpoints();
app.MapContractsEndpoints();
app.MapCompaniesEndpoints();
app.MapFinanceEndpoints();

app.Run();
