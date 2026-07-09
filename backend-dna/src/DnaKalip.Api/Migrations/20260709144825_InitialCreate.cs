using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DnaKalip.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Companies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    CompanyType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    TaxNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Companies", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExchangeRates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    RateToTry = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExchangeRates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExpenseInvoices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WorkOrderNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    InvoiceType = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    InvoiceDate = table.Column<DateOnly>(type: "date", nullable: false),
                    DueDays = table.Column<int>(type: "int", nullable: false),
                    PaymentDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(25)", maxLength: 25, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExpenseInvoices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Contracts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ContractNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FinanceTab = table.Column<string>(type: "nvarchar(25)", maxLength: 25, nullable: false),
                    ContractType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ContractYear = table.Column<int>(type: "int", nullable: true),
                    ContractNumberSuffix = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ProjectNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ContractDate = table.Column<DateOnly>(type: "date", nullable: true),
                    CompanyId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CustomerProject = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    WorkOrderNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ReferenceNumber = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    PartName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    MoldCount = table.Column<int>(type: "int", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    ExchangeRateType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    FixedExchangeRate = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Contracts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Contracts_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ContractMilestones",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ContractId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TrackingKey = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    MilestoneIndex = table.Column<int>(type: "int", nullable: false),
                    SubMilestoneIndex = table.Column<int>(type: "int", nullable: true),
                    Condition = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SubMilestoneName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Rate = table.Column<decimal>(type: "decimal(9,4)", precision: 9, scale: 4, nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DueDays = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContractMilestones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ContractMilestones_Contracts_ContractId",
                        column: x => x.ContractId,
                        principalTable: "Contracts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PaymentTrackings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ContractMilestoneId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ApprovalDate = table.Column<DateOnly>(type: "date", nullable: true),
                    PaymentDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(25)", maxLength: 25, nullable: false),
                    DueDaysOverride = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentTrackings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PaymentTrackings_ContractMilestones_ContractMilestoneId",
                        column: x => x.ContractMilestoneId,
                        principalTable: "ContractMilestones",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Companies_Name",
                table: "Companies",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_ContractMilestones_ContractId_TrackingKey",
                table: "ContractMilestones",
                columns: new[] { "ContractId", "TrackingKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Contracts_CompanyId",
                table: "Contracts",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Contracts_ContractNumber",
                table: "Contracts",
                column: "ContractNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Contracts_WorkOrderNumber",
                table: "Contracts",
                column: "WorkOrderNumber");

            migrationBuilder.CreateIndex(
                name: "IX_ExchangeRates_Currency_EffectiveDate",
                table: "ExchangeRates",
                columns: new[] { "Currency", "EffectiveDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseInvoices_InvoiceDate",
                table: "ExpenseInvoices",
                column: "InvoiceDate");

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseInvoices_WorkOrderNumber",
                table: "ExpenseInvoices",
                column: "WorkOrderNumber");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentTrackings_ContractMilestoneId",
                table: "PaymentTrackings",
                column: "ContractMilestoneId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExchangeRates");

            migrationBuilder.DropTable(
                name: "ExpenseInvoices");

            migrationBuilder.DropTable(
                name: "PaymentTrackings");

            migrationBuilder.DropTable(
                name: "ContractMilestones");

            migrationBuilder.DropTable(
                name: "Contracts");

            migrationBuilder.DropTable(
                name: "Companies");
        }
    }
}
