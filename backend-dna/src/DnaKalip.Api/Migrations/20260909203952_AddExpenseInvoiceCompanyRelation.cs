using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DnaKalip.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenseInvoiceCompanyRelation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CompanyId",
                table: "ExpenseInvoices",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE invoice
                SET CompanyId = company.Id
                FROM ExpenseInvoices AS invoice
                INNER JOIN Companies AS company
                    ON LTRIM(RTRIM(invoice.Description)) = LTRIM(RTRIM(company.Name))
                WHERE invoice.CompanyId IS NULL;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseInvoices_CompanyId",
                table: "ExpenseInvoices",
                column: "CompanyId");

            migrationBuilder.AddForeignKey(
                name: "FK_ExpenseInvoices_Companies_CompanyId",
                table: "ExpenseInvoices",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ExpenseInvoices_Companies_CompanyId",
                table: "ExpenseInvoices");

            migrationBuilder.DropIndex(
                name: "IX_ExpenseInvoices_CompanyId",
                table: "ExpenseInvoices");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "ExpenseInvoices");
        }
    }
}
