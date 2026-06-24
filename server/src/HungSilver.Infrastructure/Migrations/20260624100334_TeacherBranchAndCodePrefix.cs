using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HungSilver.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TeacherBranchAndCodePrefix : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "TeacherProfiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TeacherCodePrefix",
                table: "Branches",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeacherProfiles_BranchId",
                table: "TeacherProfiles",
                column: "BranchId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TeacherProfiles_BranchId",
                table: "TeacherProfiles");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "TeacherProfiles");

            migrationBuilder.DropColumn(
                name: "TeacherCodePrefix",
                table: "Branches");
        }
    }
}
