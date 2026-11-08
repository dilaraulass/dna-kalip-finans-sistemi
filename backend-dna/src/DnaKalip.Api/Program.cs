using DnaKalip.Api.Data;
using DnaKalip.Api.Domain;
using DnaKalip.Api.Endpoints;
using DnaKalip.Api.Services.Contracts;
using DnaKalip.Api.Services.Development;
using DnaKalip.Api.Services.Security;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using System.Threading.RateLimiting;
using System.Globalization;
using Microsoft.AspNetCore.Antiforgery;

var builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsDevelopment())
{
    builder.Logging.ClearProviders();
    builder.Logging.AddConsole();
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("ProductionCors", policy =>
    {
        var allowedOrigins = builder.Configuration
            .GetSection("Cors:AllowedOrigins")
            .Get<string[]>() ?? ["https://app.example.com"];

        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddHealthChecks();
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = "dna_csrf";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.Path = "/";
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
});
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("login", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0,
            AutoReplenishment = true,
        }));
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            context.HttpContext.Response.Headers.RetryAfter = Math.Ceiling(retryAfter.TotalSeconds)
                .ToString(CultureInfo.InvariantCulture);
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            message = "Çok fazla giriş denemesi yaptınız. Bir dakika bekleyip tekrar deneyin.",
        }, cancellationToken);
    };
});

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddHttpClient();
builder.Services.AddDbContext<DnaKalipDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services
    .AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(
        Path.Combine(builder.Environment.ContentRootPath, "App_Data", "DataProtectionKeys")));
builder.Services.AddScoped<ContractMilestoneSyncService>();
builder.Services.AddScoped<PasswordHasher>();
builder.Services.AddScoped<AccessService>();
builder.Services.AddScoped<InitialAdminSeeder>();
builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "dna_auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.Cookie.IsEssential = true;
        options.SlidingExpiration = true;
        options.Events.OnValidatePrincipal = context =>
            context.HttpContext.RequestServices.GetRequiredService<AccessService>().ValidateCookie(context);
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
    options.AddPolicy("CompanyManage", policy => policy.RequireAuthenticatedUser().RequireAssertion(c =>
        c.User.Has(Permissions.ContractsEdit) || c.User.Has(Permissions.ExpensesEdit)));
    foreach (var permission in Permissions.Catalog.Keys)
        options.AddPolicy(permission, policy => policy.RequireAuthenticatedUser()
            .RequireAssertion(context => context.User.Has(permission)));
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

if (!app.Environment.IsDevelopment() && app.Configuration["ReverseProxy:Address"] is { Length: > 0 } proxy)
{
    var address = System.Net.IPAddress.Parse(proxy);
    var forwarding = new ForwardedHeadersOptions
    {
        ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor |
                           Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto,
        ForwardLimit = 1
    };
    forwarding.KnownIPNetworks.Clear();
    forwarding.KnownProxies.Clear();
    forwarding.KnownProxies.Add(address);
    app.UseForwardedHeaders(forwarding);
}

if (!app.Environment.IsDevelopment())
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<DnaKalipDbContext>();
    var applyMigrationsOnStartup = string.Equals(
        app.Configuration["Database:ApplyMigrationsOnStartup"],
        "true",
        StringComparison.OrdinalIgnoreCase);

    if (applyMigrationsOnStartup)
    {
        await db.Database.MigrateAsync();
    }

    var initialAdminSeeder = scope.ServiceProvider.GetRequiredService<InitialAdminSeeder>();
    await initialAdminSeeder.SeedAsync(CancellationToken.None);
}

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
    app.UseHsts();
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseRouting();
app.UseCors("ProductionCors");
app.UseRateLimiter();
app.MapHealthChecks("/health");

app.Use(async (context, next) =>
{
    try { await next(context); }
    catch (DbUpdateConcurrencyException) when (!context.Response.HasStarted)
    {
        context.Response.StatusCode = 409;
        await context.Response.WriteAsJsonAsync(new { message = "Kayıt başka bir kullanıcı tarafından değiştirildi. Yenileyip tekrar deneyin." });
    }
    catch (System.Text.Json.JsonException) when (!context.Response.HasStarted)
    {
        context.Response.StatusCode = 400;
        await context.Response.WriteAsJsonAsync(new { message = "Form verisi geçersiz." });
    }
});
app.UseAuthentication();
app.UseAuthorization();

// JSON Minimal APIs do not automatically validate antiforgery tokens.
// Protect every unsafe API method, including login/logout and development tools.
app.Use(async (context, next) =>
{
    var request = context.Request;
    if (request.Path.StartsWithSegments("/api") &&
        !HttpMethods.IsGet(request.Method) && !HttpMethods.IsHead(request.Method) &&
        !HttpMethods.IsOptions(request.Method))
    {
        var antiforgery = context.RequestServices.GetRequiredService<IAntiforgery>();
        try
        {
            if (!request.Headers.ContainsKey("X-CSRF-TOKEN"))
                throw new AntiforgeryValidationException("Missing CSRF header.");
            await antiforgery.ValidateRequestAsync(context);
        }
        catch (AntiforgeryValidationException)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new
            {
                code = "csrf_validation_failed",
                message = "Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin. İşlem kaydedilmedi.",
            });
            return;
        }
    }
    await next(context);
});

app.MapAuthEndpoints();
app.MapUsersEndpoints();
app.MapContractsEndpoints();
app.MapContractWorkflowEndpoints();
app.MapCompaniesEndpoints();
app.MapFinanceEndpoints();

if (!app.Environment.IsDevelopment())
{
    app.MapFallback(async context =>
    {
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        var indexPath = Path.Combine(
            app.Environment.WebRootPath ?? string.Empty,
            "index.html");

        if (!File.Exists(indexPath))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.SendFileAsync(indexPath);
    });
}

app.Run();
