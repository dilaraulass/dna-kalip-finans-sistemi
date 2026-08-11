using System;
using DnaKalip.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DnaKalip.Api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(DnaKalipDbContext))]
    [Migration("20260811100000_AddExpenseInvoiceArchiving")]
    public partial class AddExpenseInvoiceArchiving : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ArchivedAt",
                table: "ExpenseInvoices",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "ExpenseInvoices",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseInvoices_IsArchived",
                table: "ExpenseInvoices",
                column: "IsArchived");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ExpenseInvoices_IsArchived",
                table: "ExpenseInvoices");

            migrationBuilder.DropColumn(
                name: "ArchivedAt",
                table: "ExpenseInvoices");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "ExpenseInvoices");
        }
    }
}
