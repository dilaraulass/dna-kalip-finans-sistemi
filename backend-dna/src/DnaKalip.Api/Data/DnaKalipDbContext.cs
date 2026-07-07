using DnaKalip.Api.Entities;
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
    public DbSet<ExchangeRate> ExchangeRates => Set<ExchangeRate>();

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

            entity.HasIndex(contract => contract.ContractNumber).IsUnique();
            entity.HasIndex(contract => contract.WorkOrderNumber);

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
            entity.HasIndex(payment => payment.ContractMilestoneId).IsUnique();

            entity
                .HasOne(payment => payment.ContractMilestone)
                .WithOne(milestone => milestone.PaymentTracking)
                .HasForeignKey<PaymentTracking>(payment => payment.ContractMilestoneId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ExpenseInvoice>(entity =>
        {
            entity.Property(invoice => invoice.WorkOrderNumber).HasMaxLength(50);
            entity.Property(invoice => invoice.InvoiceType).HasMaxLength(150);
            entity.Property(invoice => invoice.Description).HasMaxLength(500).IsRequired();
            entity.Property(invoice => invoice.Amount).HasPrecision(18, 2);
            entity.Property(invoice => invoice.Currency).HasMaxLength(3).IsRequired();
            entity.Property(invoice => invoice.Status).HasMaxLength(25).IsRequired();

            entity.HasIndex(invoice => invoice.WorkOrderNumber);
            entity.HasIndex(invoice => invoice.InvoiceDate);
        });

        modelBuilder.Entity<ExchangeRate>(entity =>
        {
            entity.Property(rate => rate.Currency).HasMaxLength(3).IsRequired();
            entity.Property(rate => rate.RateToTry).HasPrecision(18, 6);

            entity.HasIndex(rate => new { rate.Currency, rate.EffectiveDate }).IsUnique();
        });
    }
}
