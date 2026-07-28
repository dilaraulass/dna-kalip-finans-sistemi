using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DnaKalip.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddContractFormDataJson : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FormDataJson",
                table: "Contracts",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FormDataJson",
                table: "Contracts");
        }
    }
}
