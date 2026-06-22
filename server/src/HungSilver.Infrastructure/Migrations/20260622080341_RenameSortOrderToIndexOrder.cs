using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HungSilver.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameSortOrderToIndexOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "SortOrder",
                table: "Subjects",
                newName: "IndexOrder");

            migrationBuilder.RenameIndex(
                name: "IX_Subjects_SortOrder",
                table: "Subjects",
                newName: "IX_Subjects_IndexOrder");

            migrationBuilder.RenameColumn(
                name: "SortOrder",
                table: "GradeCategories",
                newName: "IndexOrder");

            migrationBuilder.RenameIndex(
                name: "IX_GradeCategories_SortOrder",
                table: "GradeCategories",
                newName: "IX_GradeCategories_IndexOrder");

            migrationBuilder.RenameColumn(
                name: "SortOrder",
                table: "Branches",
                newName: "IndexOrder");

            migrationBuilder.RenameIndex(
                name: "IX_Branches_SortOrder",
                table: "Branches",
                newName: "IX_Branches_IndexOrder");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "IndexOrder",
                table: "Subjects",
                newName: "SortOrder");

            migrationBuilder.RenameIndex(
                name: "IX_Subjects_IndexOrder",
                table: "Subjects",
                newName: "IX_Subjects_SortOrder");

            migrationBuilder.RenameColumn(
                name: "IndexOrder",
                table: "GradeCategories",
                newName: "SortOrder");

            migrationBuilder.RenameIndex(
                name: "IX_GradeCategories_IndexOrder",
                table: "GradeCategories",
                newName: "IX_GradeCategories_SortOrder");

            migrationBuilder.RenameColumn(
                name: "IndexOrder",
                table: "Branches",
                newName: "SortOrder");

            migrationBuilder.RenameIndex(
                name: "IX_Branches_IndexOrder",
                table: "Branches",
                newName: "IX_Branches_SortOrder");
        }
    }
}
