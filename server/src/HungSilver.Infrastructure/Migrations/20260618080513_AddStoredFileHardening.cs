using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HungSilver.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStoredFileHardening : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Sha256",
                table: "StoredFiles",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "Visibility",
                table: "StoredFiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_StoredFiles_Sha256",
                table: "StoredFiles",
                column: "Sha256");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_StoredFiles_Sha256",
                table: "StoredFiles");

            migrationBuilder.DropColumn(
                name: "Sha256",
                table: "StoredFiles");

            migrationBuilder.DropColumn(
                name: "Visibility",
                table: "StoredFiles");
        }
    }
}
