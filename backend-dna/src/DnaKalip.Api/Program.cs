using DnaKalip.Api.Data;
using DnaKalip.Api.Endpoints;
using DnaKalip.Api.Services.Contracts;
using DnaKalip.Api.Services.Development;
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
builder.Services.AddScoped<ContractMilestoneSyncService>();

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddScoped<JsonSeedService>();
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

app.MapContractsEndpoints();
app.MapCompaniesEndpoints();
app.MapFinanceEndpoints();

app.Run();
