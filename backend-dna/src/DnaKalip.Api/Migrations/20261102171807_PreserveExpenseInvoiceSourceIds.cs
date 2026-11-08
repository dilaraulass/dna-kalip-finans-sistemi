using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DnaKalip.Api.Migrations
{
    /// <inheritdoc />
    public partial class PreserveExpenseInvoiceSourceIds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SourceInvoiceId",
                table: "ExpenseInvoices",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true,
                collation: "Latin1_General_100_BIN2");

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseInvoices_SourceInvoiceId",
                table: "ExpenseInvoices",
                column: "SourceInvoiceId",
                unique: true,
                filter: "[SourceInvoiceId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ExpenseInvoices_SourceInvoiceId",
                table: "ExpenseInvoices");

            migrationBuilder.DropColumn(
                name: "SourceInvoiceId",
                table: "ExpenseInvoices");
        }
    }
}
