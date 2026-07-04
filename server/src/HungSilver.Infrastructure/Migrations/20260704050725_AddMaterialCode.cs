using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HungSilver.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMaterialCode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Code",
                table: "LearningMaterials",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            // Backfill mã TL0001.. cho dữ liệu cũ (kể cả row đã xóa mềm — mã không tái cấp)
            // TRƯỚC khi tạo unique index, nếu không nhiều row "" sẽ vi phạm unique. DB rỗng: no-op.
            migrationBuilder.Sql("""
                WITH ordered AS (
                    SELECT "Id", ROW_NUMBER() OVER (ORDER BY "CreatedAt", "Id") AS rn
                    FROM "LearningMaterials"
                )
                UPDATE "LearningMaterials" m
                SET "Code" = 'TL' || LPAD(o.rn::text, 4, '0')
                FROM ordered o
                WHERE m."Id" = o."Id";
                """);

            migrationBuilder.CreateIndex(
                name: "IX_LearningMaterials_Code",
                table: "LearningMaterials",
                column: "Code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LearningMaterials_Code",
                table: "LearningMaterials");

            migrationBuilder.DropColumn(
                name: "Code",
                table: "LearningMaterials");
        }
    }
}
