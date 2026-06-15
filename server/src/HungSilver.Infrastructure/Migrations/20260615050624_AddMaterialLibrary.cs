using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HungSilver.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMaterialLibrary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "ClassId",
                table: "LearningMaterials",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "CategoryId",
                table: "LearningMaterials",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "MaterialCategories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaterialCategories", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LearningMaterials_CategoryId",
                table: "LearningMaterials",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_MaterialCategories_SortOrder",
                table: "MaterialCategories",
                column: "SortOrder");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MaterialCategories");

            migrationBuilder.DropIndex(
                name: "IX_LearningMaterials_CategoryId",
                table: "LearningMaterials");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "LearningMaterials");

            migrationBuilder.AlterColumn<Guid>(
                name: "ClassId",
                table: "LearningMaterials",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
