using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HungSilver.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMaterialFolders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "FolderId",
                table: "LearningMaterials",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "MaterialFolders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    GradeBand = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CoverFileId = table.Column<Guid>(type: "uuid", nullable: true),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaterialFolders", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LearningMaterials_FolderId",
                table: "LearningMaterials",
                column: "FolderId");

            migrationBuilder.CreateIndex(
                name: "IX_MaterialFolders_SubjectId",
                table: "MaterialFolders",
                column: "SubjectId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MaterialFolders");

            migrationBuilder.DropIndex(
                name: "IX_LearningMaterials_FolderId",
                table: "LearningMaterials");

            migrationBuilder.DropColumn(
                name: "FolderId",
                table: "LearningMaterials");
        }
    }
}
