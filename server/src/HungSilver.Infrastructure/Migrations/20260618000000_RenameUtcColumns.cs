using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HungSilver.Infrastructure.Migrations;

/// <summary>
/// Đổi tên cột *Utc → bỏ hậu tố (CreatedAtUtc → CreatedAt, v.v.)
/// vì hệ thống chuyển sang dùng DateTime.Now (giờ local) thay vì DateTime.UtcNow.
/// </summary>
public partial class RenameUtcColumns : Migration
{
    // Tất cả bảng có BaseEntity (CreatedAtUtc, UpdatedAtUtc, DeletedAtUtc)
    private static readonly string[] AllBaseTables =
    [
        "AspNetUsers",
        "Products",
        "RefreshTokens",
        "Students",
        "Curriculums",
        "Classes",
        "Enrollments",
        "ClassScheduleSlots",
        "ClassSessions",
        "StudentSessionRecords",
        "PointEntries",
        "RewardRedemptions",
        "TeacherJournals",
        "SessionReports",
        "StudentAssessments",
        "MonthlyEvaluations",
        "MonthlyParentReports",
        "TuitionInvoices",
        "LearningMaterials",
        "MaterialCategories",
        "Assignments",
        "Submissions",
        "StoredFiles",
        "Notifications",
        "NotificationDeliveries",
        "Settings"
    ];

    protected override void Up(MigrationBuilder migrationBuilder)
    {
        foreach (var table in AllBaseTables)
        {
            migrationBuilder.RenameColumn(name: "CreatedAtUtc", table: table, newName: "CreatedAt");
            migrationBuilder.RenameColumn(name: "UpdatedAtUtc", table: table, newName: "UpdatedAt");
            migrationBuilder.RenameColumn(name: "DeletedAtUtc", table: table, newName: "DeletedAt");
        }

        // RefreshTokens: cột riêng
        migrationBuilder.RenameColumn(name: "ExpiresAtUtc", table: "RefreshTokens", newName: "ExpiresAt");
        migrationBuilder.RenameColumn(name: "RevokedAtUtc", table: "RefreshTokens", newName: "RevokedAt");

        // SessionReports: cột riêng
        migrationBuilder.RenameColumn(name: "GeneratedAtUtc", table: "SessionReports", newName: "GeneratedAt");

        // NotificationDeliveries: cột riêng
        migrationBuilder.RenameColumn(name: "SentAtUtc", table: "NotificationDeliveries", newName: "SentAt");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        foreach (var table in AllBaseTables)
        {
            migrationBuilder.RenameColumn(name: "CreatedAt", table: table, newName: "CreatedAtUtc");
            migrationBuilder.RenameColumn(name: "UpdatedAt", table: table, newName: "UpdatedAtUtc");
            migrationBuilder.RenameColumn(name: "DeletedAt", table: table, newName: "DeletedAtUtc");
        }

        migrationBuilder.RenameColumn(name: "ExpiresAt", table: "RefreshTokens", newName: "ExpiresAtUtc");
        migrationBuilder.RenameColumn(name: "RevokedAt", table: "RefreshTokens", newName: "RevokedAtUtc");
        migrationBuilder.RenameColumn(name: "GeneratedAt", table: "SessionReports", newName: "GeneratedAtUtc");
        migrationBuilder.RenameColumn(name: "SentAt", table: "NotificationDeliveries", newName: "SentAtUtc");
    }
}
