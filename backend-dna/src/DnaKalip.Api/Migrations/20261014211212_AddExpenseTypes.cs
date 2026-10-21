using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace DnaKalip.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenseTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ExpenseTypeId",
                table: "ExpenseInvoices",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ExpenseTypes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExpenseTypes", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "ExpenseTypes",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Diğer" },
                    { 2, "Fason İşçilik" },
                    { 3, "Hammadde" },
                    { 4, "Standart Malzeme" },
                    { 5, "Isıl İşlem" },
                    { 6, "Tel Erezyon" }
                });

            // Preserve custom legacy names, including invoices moved to deleted records.
            // Keep InvoiceType unchanged so historical JSON import keys remain stable.
            migrationBuilder.Sql("""
                INSERT INTO [ExpenseTypes] ([Name])
                SELECT DISTINCT LTRIM(RTRIM(invoice.[InvoiceType]))
                FROM [ExpenseInvoices] AS invoice
                WHERE NULLIF(LTRIM(RTRIM(invoice.[InvoiceType])), N'') IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM [ExpenseTypes] AS type
                      WHERE type.[Name] = LTRIM(RTRIM(invoice.[InvoiceType])));

                UPDATE invoice
                SET [ExpenseTypeId] = type.[Id]
                FROM [ExpenseInvoices] AS invoice
                INNER JOIN [ExpenseTypes] AS type
                    ON type.[Name] = COALESCE(NULLIF(LTRIM(RTRIM(invoice.[InvoiceType])), N''), N'Diğer')
                WHERE invoice.[ExpenseTypeId] IS NULL;

                IF EXISTS (SELECT 1 FROM [ExpenseInvoices] WHERE [ExpenseTypeId] IS NULL)
                    THROW 51000, 'Expense type backfill did not complete.', 1;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseInvoices_ExpenseTypeId",
                table: "ExpenseInvoices",
                column: "ExpenseTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseTypes_Name",
                table: "ExpenseTypes",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ExpenseInvoices_ExpenseTypes_ExpenseTypeId",
                table: "ExpenseInvoices",
                column: "ExpenseTypeId",
                principalTable: "ExpenseTypes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ExpenseInvoices_ExpenseTypes_ExpenseTypeId",
                table: "ExpenseInvoices");

            migrationBuilder.DropTable(
                name: "ExpenseTypes");

            migrationBuilder.DropIndex(
                name: "IX_ExpenseInvoices_ExpenseTypeId",
                table: "ExpenseInvoices");

            migrationBuilder.DropColumn(
                name: "ExpenseTypeId",
                table: "ExpenseInvoices");
        }
    }
}
