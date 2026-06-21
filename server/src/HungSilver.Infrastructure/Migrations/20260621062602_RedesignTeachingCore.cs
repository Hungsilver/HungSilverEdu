using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HungSilver.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RedesignTeachingCore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "DiscountAmount",
                table: "TuitionInvoices",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "PaidAmount",
                table: "TuitionInvoices",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "Students",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "Students",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BranchCode",
                table: "Classes",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BranchName",
                table: "Classes",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClassCode",
                table: "Classes",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "GradeId",
                table: "Classes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GradeName",
                table: "Classes",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubjectName",
                table: "Classes",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TeacherName",
                table: "Classes",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TeacherProfileId",
                table: "Classes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TuitionFee",
                table: "Classes",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "GradeCategories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GradeCategories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TeacherProfiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TeacherCode = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    DateOfBirth = table.Column<DateOnly>(type: "date", nullable: true),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Note = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeacherProfiles", x => x.Id);
                });

            migrationBuilder.Sql("""
                UPDATE "Classes"
                SET "ClassCode" = 'LH' || substring(replace("Id"::text, '-', ''), 1, 10)
                WHERE "ClassCode" = '';

                UPDATE "Classes" c
                SET "BranchCode" = b."Code", "BranchName" = b."Name"
                FROM "Branches" b
                WHERE c."BranchId" = b."Id";

                UPDATE "Classes" c
                SET "SubjectName" = s."Name"
                FROM "Subjects" s
                WHERE c."SubjectId" = s."Id";

                UPDATE "Classes"
                SET "GradeName" = "GradeBand"
                WHERE "GradeName" IS NULL AND "GradeBand" IS NOT NULL;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_TuitionInvoices_ClassId",
                table: "TuitionInvoices",
                column: "ClassId");

            migrationBuilder.CreateIndex(
                name: "IX_Classes_ClassCode",
                table: "Classes",
                column: "ClassCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Classes_GradeId",
                table: "Classes",
                column: "GradeId");

            migrationBuilder.CreateIndex(
                name: "IX_Classes_TeacherProfileId",
                table: "Classes",
                column: "TeacherProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_GradeCategories_Code",
                table: "GradeCategories",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GradeCategories_SortOrder",
                table: "GradeCategories",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_TeacherProfiles_FullName",
                table: "TeacherProfiles",
                column: "FullName");

            migrationBuilder.CreateIndex(
                name: "IX_TeacherProfiles_TeacherCode",
                table: "TeacherProfiles",
                column: "TeacherCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeacherProfiles_UserId",
                table: "TeacherProfiles",
                column: "UserId",
                unique: true,
                filter: "\"UserId\" IS NOT NULL AND NOT \"IsDeleted\"");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GradeCategories");

            migrationBuilder.DropTable(
                name: "TeacherProfiles");

            migrationBuilder.DropIndex(
                name: "IX_TuitionInvoices_ClassId",
                table: "TuitionInvoices");

            migrationBuilder.DropIndex(
                name: "IX_Classes_ClassCode",
                table: "Classes");

            migrationBuilder.DropIndex(
                name: "IX_Classes_GradeId",
                table: "Classes");

            migrationBuilder.DropIndex(
                name: "IX_Classes_TeacherProfileId",
                table: "Classes");

            migrationBuilder.DropColumn(
                name: "DiscountAmount",
                table: "TuitionInvoices");

            migrationBuilder.DropColumn(
                name: "PaidAmount",
                table: "TuitionInvoices");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "Note",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "BranchCode",
                table: "Classes");

            migrationBuilder.DropColumn(
                name: "BranchName",
                table: "Classes");

            migrationBuilder.DropColumn(
                name: "ClassCode",
                table: "Classes");

            migrationBuilder.DropColumn(
                name: "GradeId",
                table: "Classes");

            migrationBuilder.DropColumn(
                name: "GradeName",
                table: "Classes");

            migrationBuilder.DropColumn(
                name: "SubjectName",
                table: "Classes");

            migrationBuilder.DropColumn(
                name: "TeacherName",
                table: "Classes");

            migrationBuilder.DropColumn(
                name: "TeacherProfileId",
                table: "Classes");

            migrationBuilder.DropColumn(
                name: "TuitionFee",
                table: "Classes");
        }
    }
}
