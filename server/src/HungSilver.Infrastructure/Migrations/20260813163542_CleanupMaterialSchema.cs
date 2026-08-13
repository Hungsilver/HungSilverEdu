using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HungSilver.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CleanupMaterialSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MaterialCategories");

            migrationBuilder.DropIndex(
                name: "IX_LearningMaterials_CategoryId",
                table: "LearningMaterials");

            migrationBuilder.DropIndex(
                name: "IX_LearningMaterials_ClassId",
                table: "LearningMaterials");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "LearningMaterials");

            migrationBuilder.DropColumn(
                name: "ClassId",
                table: "LearningMaterials");

            migrationBuilder.DropColumn(
                name: "Type",
                table: "LearningMaterials");

            migrationBuilder.DropColumn(
                name: "UploadedByUserId",
                table: "LearningMaterials");

            migrationBuilder.DropColumn(
                name: "Language",
                table: "Exams");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CategoryId",
                table: "LearningMaterials",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ClassId",
                table: "LearningMaterials",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Type",
                table: "LearningMaterials",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "UploadedByUserId",
                table: "LearningMaterials",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Language",
                table: "Exams",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "MaterialCategories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
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
                name: "IX_LearningMaterials_ClassId",
                table: "LearningMaterials",
                column: "ClassId");

            migrationBuilder.CreateIndex(
                name: "IX_MaterialCategories_SortOrder",
                table: "MaterialCategories",
                column: "SortOrder");
        }
    }
}
