using DnaKalip.Api.Entities;
using DnaKalip.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace DnaKalip.Api.Data;

public class DnaKalipDbContext(DbContextOptions<DnaKalipDbContext> options)
    : DbContext(options)
{
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Contract> Contracts => Set<Contract>();
    public DbSet<ContractMilestone> ContractMilestones => Set<ContractMilestone>();
    public DbSet<PaymentTracking> PaymentTrackings => Set<PaymentTracking>();
    public DbSet<ExpenseInvoice> ExpenseInvoices => Set<ExpenseInvoice>();
    public DbSet<ExpenseType> ExpenseTypes => Set<ExpenseType>();
    public DbSet<ExchangeRate> ExchangeRates => Set<ExchangeRate>();
    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<AppRole> AppRoles => Set<AppRole>();
    public DbSet<AppUserRole> AppUserRoles => Set<AppUserRole>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<UserPermission> UserPermissions => Set<UserPermission>();
    public DbSet<AccessAudit> AccessAudits => Set<AccessAudit>();
    public DbSet<UserNotification> UserNotifications => Set<UserNotification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Company>(entity =>
        {
            entity.Property(company => company.Name).HasMaxLength(250).IsRequired();
            entity.Property(company => company.CompanyType).HasMaxLength(50);
            entity.Property(company => company.TaxNumber).HasMaxLength(50);
            entity.Property(company => company.Email).HasMaxLength(250);
            entity.Property(company => company.Phone).HasMaxLength(50);
            entity.HasIndex(company => company.Name);
        });

        modelBuilder.Entity<Contract>(entity =>
        {
            entity.Property(c => c.WorkflowStatus).HasMaxLength(20).HasDefaultValue("active");
            entity.Property(c => c.ReturnReason).HasMaxLength(1000);
            entity.Property(c => c.Version).IsRowVersion();
            entity.HasIndex(c => new { c.WorkflowStatus, c.AssignedToUserId });
            entity.Property(contract => contract.ContractNumber).HasMaxLength(100).IsRequired();
            entity.Property(contract => contract.FinanceTab).HasMaxLength(25).IsRequired();
            entity.Property(contract => contract.ContractType).HasMaxLength(100);
            entity.Property(contract => contract.ContractNumberSuffix).HasMaxLength(50);
            entity.Property(contract => contract.ProjectNumber).HasMaxLength(50);
            entity.Property(contract => contract.CustomerProject).HasMaxLength(250);
            entity.Property(contract => contract.WorkOrderNumber).HasMaxLength(50);
            entity.Property(contract => contract.ReferenceNumber).HasMaxLength(150);
            entity.Property(contract => contract.PartName).HasMaxLength(250);
            entity.Property(contract => contract.TotalAmount).HasPrecision(18, 2);
            entity.Property(contract => contract.Currency).HasMaxLength(3).IsRequired();
            entity.Property(contract => contract.ExchangeRateType).HasMaxLength(50);
            entity.Property(contract => contract.FixedExchangeRate).HasPrecision(18, 6);
            entity.Property(contract => contract.FormDataJson).HasColumnType("nvarchar(max)");
            entity.Property(contract => contract.InvoiceIssued).HasDefaultValue(false);
            entity.Property(contract => contract.InvoiceNumber).HasMaxLength(100);
            entity.Property(contract => contract.InvoiceDataConflict).HasDefaultValue(false);
            entity.Property(contract => contract.IsArchived).HasDefaultValue(false);

            entity.HasIndex(contract => contract.ContractNumber).IsUnique();
            entity.HasIndex(contract => contract.WorkOrderNumber);
            entity.HasIndex(contract => contract.IsArchived);

            entity
                .HasOne(contract => contract.Company)
                .WithMany(company => company.Contracts)
                .HasForeignKey(contract => contract.CompanyId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ContractMilestone>(entity =>
        {
            entity.Property(milestone => milestone.TrackingKey).HasMaxLength(50).IsRequired();
            entity.Property(milestone => milestone.Condition).HasMaxLength(500);
            entity.Property(milestone => milestone.SubMilestoneName).HasMaxLength(150);
            entity.Property(milestone => milestone.Rate).HasPrecision(9, 4);
            entity.Property(milestone => milestone.Amount).HasPrecision(18, 2);

            entity.HasIndex(milestone => new { milestone.ContractId, milestone.TrackingKey }).IsUnique();

            entity
                .HasOne(milestone => milestone.Contract)
                .WithMany(contract => contract.Milestones)
                .HasForeignKey(milestone => milestone.ContractId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PaymentTracking>(entity =>
        {
            entity.Property(payment => payment.Status).HasMaxLength(25).IsRequired();
            entity.Property(payment => payment.InvoiceIssued).HasDefaultValue(false);
            entity.Property(payment => payment.InvoiceNumber).HasMaxLength(100);
            entity.HasIndex(payment => payment.ContractMilestoneId).IsUnique();

            entity
                .HasOne(payment => payment.ContractMilestone)
                .WithOne(milestone => milestone.PaymentTracking)
                .HasForeignKey<PaymentTracking>(payment => payment.ContractMilestoneId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ExpenseInvoice>(entity =>
        {
            entity.HasOne(invoice => invoice.ExpenseType)
                .WithMany()
                .HasForeignKey(invoice => invoice.ExpenseTypeId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.Property(invoice => invoice.WorkOrderNumber).HasMaxLength(50);
            entity.Property(invoice => invoice.InvoiceType).HasMaxLength(150);
            entity.Property(invoice => invoice.Description).HasMaxLength(500).IsRequired();
            entity.Property(invoice => invoice.Amount).HasPrecision(18, 2);
            entity.Property(invoice => invoice.Currency).HasMaxLength(3).IsRequired();
            entity.Property(invoice => invoice.Status).HasMaxLength(25).IsRequired();
            entity.Property(invoice => invoice.InvoiceIssued).HasDefaultValue(false);
            entity.Property(invoice => invoice.InvoiceNumber).HasMaxLength(100);
            entity.Property(invoice => invoice.IsArchived).HasDefaultValue(false);

            entity.HasIndex(invoice => invoice.WorkOrderNumber);
            entity.HasIndex(invoice => invoice.InvoiceDate);
            entity.HasIndex(invoice => invoice.IsArchived);
            entity.HasIndex(invoice => invoice.CompanyId);

            entity
                .HasOne(invoice => invoice.Company)
                .WithMany(company => company.ExpenseInvoices)
                .HasForeignKey(invoice => invoice.CompanyId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ExpenseType>(entity =>
        {
            entity.Property(type => type.Name).HasMaxLength(150).IsRequired();
            entity.HasIndex(type => type.Name).IsUnique();
            entity.HasData(
                new ExpenseType { Id = 1, Name = "Diğer" },
                new ExpenseType { Id = 2, Name = "Fason İşçilik" },
                new ExpenseType { Id = 3, Name = "Hammadde" },
                new ExpenseType { Id = 4, Name = "Standart Malzeme" },
                new ExpenseType { Id = 5, Name = "Isıl İşlem" },
                new ExpenseType { Id = 6, Name = "Tel Erezyon" });
        });

        modelBuilder.Entity<ExchangeRate>(entity =>
        {
            entity.Property(rate => rate.Currency).HasMaxLength(3).IsRequired();
            entity.Property(rate => rate.RateToTry).HasPrecision(18, 6);

            entity.HasIndex(rate => new { rate.Currency, rate.EffectiveDate }).IsUnique();
        });

        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.Property(user => user.FullName).HasMaxLength(200).IsRequired();
            entity.Property(user => user.Email).HasMaxLength(250).IsRequired();
            entity.Property(user => user.NormalizedEmail).HasMaxLength(250).IsRequired();
            entity.Property(user => user.PasswordHash).HasMaxLength(500).IsRequired();
            entity.Property(user => user.IsActive).HasDefaultValue(true);

            entity.HasIndex(user => user.NormalizedEmail).IsUnique();
            entity.HasIndex(user => user.IsActive);
        });

        modelBuilder.Entity<AppRole>(entity =>
        {
            entity.Property(role => role.Name).HasMaxLength(50).IsRequired();
            entity.Property(role => role.DisplayName).HasMaxLength(100).IsRequired();

            entity.HasIndex(role => role.Name).IsUnique();

            entity.HasData(
                new AppRole
                {
                    Id = Guid.Parse("4f97df55-9d3d-46d5-a251-f65355369107"),
                    Name = DnaKalip.Api.Domain.AppRoles.Admin,
                    DisplayName = "Admin",
                },
                new AppRole
                {
                    Id = Guid.Parse("b8c99520-5c0f-4b31-a1b9-2c23cfcaf5f7"),
                    Name = DnaKalip.Api.Domain.AppRoles.Accounting,
                    DisplayName = "Muhasebe",
                });
        });

        modelBuilder.Entity<AppUserRole>(entity =>
        {
            entity.HasKey(userRole => new { userRole.UserId, userRole.RoleId });

            entity
                .HasOne(userRole => userRole.User)
                .WithMany(user => user.UserRoles)
                .HasForeignKey(userRole => userRole.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity
                .HasOne(userRole => userRole.Role)
                .WithMany(role => role.UserRoles)
                .HasForeignKey(userRole => userRole.RoleId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RolePermission>(entity =>
        {
            entity.HasKey(p => new { p.RoleId, p.Code });
            entity.Property(p => p.Code).HasMaxLength(80);
            entity.HasOne(p => p.Role).WithMany(r => r.Permissions).HasForeignKey(p => p.RoleId);
            entity.HasData(Permissions.Catalog.Keys.Select(code => new RolePermission
            {
                RoleId = Guid.Parse("b8c99520-5c0f-4b31-a1b9-2c23cfcaf5f7"), Code = code,
            }));
        });
        modelBuilder.Entity<UserPermission>(entity =>
        {
            entity.HasKey(p => new { p.UserId, p.Code });
            entity.Property(p => p.Code).HasMaxLength(80);
            entity.HasOne(p => p.User).WithMany(u => u.PermissionOverrides).HasForeignKey(p => p.UserId);
        });
        modelBuilder.Entity<AccessAudit>(entity =>
        {
            entity.Property(a => a.Action).HasMaxLength(100);
            entity.HasIndex(a => a.CreatedAt);
        });
        modelBuilder.Entity<UserNotification>(entity =>
        {
            entity.Property(n => n.Message).HasMaxLength(500);
            entity.HasIndex(n => new { n.UserId, n.IsRead, n.CreatedAt });
            entity.HasOne<AppUser>().WithMany().HasForeignKey(n => n.UserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Contract>().WithMany().HasForeignKey(n => n.ContractId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
