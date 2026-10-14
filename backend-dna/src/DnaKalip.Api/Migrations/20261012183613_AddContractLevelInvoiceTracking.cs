using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DnaKalip.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddContractLevelInvoiceTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "InvoiceDataConflict",
                table: "Contracts",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "InvoiceIssued",
                table: "Contracts",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "InvoiceNumber",
                table: "Contracts",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.Sql("""
                WITH LegacyInvoiceData AS
                (
                    SELECT
                        milestone.ContractId,
                        SUM(CASE WHEN tracking.InvoiceIssued = 1 THEN 1 ELSE 0 END) AS InvoiceIssuedCount,
                        COUNT(DISTINCT NULLIF(LTRIM(RTRIM(tracking.InvoiceNumber)), '')) AS InvoiceNumberCount,
                        SUM(CASE
                            WHEN tracking.InvoiceIssued = 1
                                AND NULLIF(LTRIM(RTRIM(tracking.InvoiceNumber)), '') IS NULL THEN 1
                            ELSE 0
                        END) AS MissingInvoiceNumberCount,
                        SUM(CASE
                            WHEN tracking.InvoiceIssued = 0
                                AND NULLIF(LTRIM(RTRIM(tracking.InvoiceNumber)), '') IS NOT NULL THEN 1
                            ELSE 0
                        END) AS UnissuedWithInvoiceNumberCount,
                        MAX(NULLIF(LTRIM(RTRIM(tracking.InvoiceNumber)), '')) AS InvoiceNumber
                    FROM ContractMilestones AS milestone
                    INNER JOIN PaymentTrackings AS tracking
                        ON tracking.ContractMilestoneId = milestone.Id
                    WHERE tracking.InvoiceIssued = 1
                        OR NULLIF(LTRIM(RTRIM(tracking.InvoiceNumber)), '') IS NOT NULL
                    GROUP BY milestone.ContractId
                )
                UPDATE contract
                SET
                    InvoiceIssued = CASE
                        WHEN legacy.InvoiceIssuedCount > 0 THEN 1
                        ELSE 0
                    END,
                    InvoiceNumber = CASE
                        WHEN legacy.InvoiceNumberCount = 1
                            AND legacy.MissingInvoiceNumberCount = 0
                            AND legacy.UnissuedWithInvoiceNumberCount = 0
                        THEN legacy.InvoiceNumber
                        ELSE NULL
                    END,
                    InvoiceDataConflict = CASE
                        WHEN legacy.InvoiceNumberCount > 1
                            OR legacy.MissingInvoiceNumberCount > 0
                            OR legacy.UnissuedWithInvoiceNumberCount > 0
                        THEN 1
                        ELSE 0
                    END
                FROM Contracts AS contract
                INNER JOIN LegacyInvoiceData AS legacy
                    ON legacy.ContractId = contract.Id;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE tracking
                SET
                    InvoiceIssued = contract.InvoiceIssued,
                    InvoiceNumber = contract.InvoiceNumber
                FROM PaymentTrackings AS tracking
                INNER JOIN ContractMilestones AS milestone
                    ON milestone.Id = tracking.ContractMilestoneId
                INNER JOIN Contracts AS contract
                    ON contract.Id = milestone.ContractId
                WHERE contract.InvoiceDataConflict = 0;
                """);

            migrationBuilder.DropColumn(
                name: "InvoiceDataConflict",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "InvoiceIssued",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "InvoiceNumber",
                table: "Contracts");
        }
    }
}
