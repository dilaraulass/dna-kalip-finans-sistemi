using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DnaKalip.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFinanceInvoiceTrackingFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "InvoiceIssued",
                table: "PaymentTrackings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "InvoiceNumber",
                table: "PaymentTrackings",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "InvoiceIssued",
                table: "ExpenseInvoices",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "InvoiceNumber",
                table: "ExpenseInvoices",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InvoiceIssued",
                table: "PaymentTrackings");

            migrationBuilder.DropColumn(
                name: "InvoiceNumber",
                table: "PaymentTrackings");

            migrationBuilder.DropColumn(
                name: "InvoiceIssued",
                table: "ExpenseInvoices");

            migrationBuilder.DropColumn(
                name: "InvoiceNumber",
                table: "ExpenseInvoices");
        }
    }
}
