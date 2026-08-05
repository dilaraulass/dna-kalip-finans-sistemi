using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DnaKalip.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddContractArchiving : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ArchivedAt",
                table: "Contracts",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "Contracts",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_Contracts_IsArchived",
                table: "Contracts",
                column: "IsArchived");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Contracts_IsArchived",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "ArchivedAt",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "Contracts");
        }
    }
}
