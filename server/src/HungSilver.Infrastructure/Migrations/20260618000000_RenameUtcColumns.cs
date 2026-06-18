using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HungSilver.Infrastructure.Migrations;

/// <summary>
/// Đổi tên cột *Utc → bỏ hậu tố + đổi kiểu timestamp with time zone → timestamp without time zone
/// vì hệ thống chuyển sang dùng DateTime.Now (giờ local) + EnableLegacyTimestampBehavior.
/// </summary>
public partial class RenameUtcColumns : Migration
{
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

    private const string OldType = "timestamp with time zone";
    private const string NewType = "timestamp without time zone";

    protected override void Up(MigrationBuilder migrationBuilder)
    {
        foreach (var table in AllBaseTables)
        {
            migrationBuilder.RenameColumn(name: "CreatedAtUtc", table: table, newName: "CreatedAt");
            migrationBuilder.RenameColumn(name: "UpdatedAtUtc", table: table, newName: "UpdatedAt");
            migrationBuilder.RenameColumn(name: "DeletedAtUtc", table: table, newName: "DeletedAt");

            migrationBuilder.AlterColumn<DateTime>(name: "CreatedAt", table: table,
                type: NewType, nullable: false, oldClrType: typeof(DateTime), oldType: OldType);
            migrationBuilder.AlterColumn<DateTime?>(name: "UpdatedAt", table: table,
                type: NewType, nullable: true, oldClrType: typeof(DateTime), oldType: OldType, oldNullable: true);
            migrationBuilder.AlterColumn<DateTime?>(name: "DeletedAt", table: table,
                type: NewType, nullable: true, oldClrType: typeof(DateTime), oldType: OldType, oldNullable: true);
        }

        // RefreshTokens
        migrationBuilder.RenameColumn(name: "ExpiresAtUtc", table: "RefreshTokens", newName: "ExpiresAt");
        migrationBuilder.RenameColumn(name: "RevokedAtUtc", table: "RefreshTokens", newName: "RevokedAt");
        migrationBuilder.AlterColumn<DateTime>(name: "ExpiresAt", table: "RefreshTokens",
            type: NewType, nullable: false, oldClrType: typeof(DateTime), oldType: OldType);
        migrationBuilder.AlterColumn<DateTime?>(name: "RevokedAt", table: "RefreshTokens",
            type: NewType, nullable: true, oldClrType: typeof(DateTime), oldType: OldType, oldNullable: true);

        // SessionReports
        migrationBuilder.RenameColumn(name: "GeneratedAtUtc", table: "SessionReports", newName: "GeneratedAt");
        migrationBuilder.AlterColumn<DateTime>(name: "GeneratedAt", table: "SessionReports",
            type: NewType, nullable: false, oldClrType: typeof(DateTime), oldType: OldType);

        // NotificationDeliveries
        migrationBuilder.RenameColumn(name: "SentAtUtc", table: "NotificationDeliveries", newName: "SentAt");
        migrationBuilder.AlterColumn<DateTime?>(name: "SentAt", table: "NotificationDeliveries",
            type: NewType, nullable: true, oldClrType: typeof(DateTime), oldType: OldType, oldNullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        foreach (var table in AllBaseTables)
        {
            migrationBuilder.AlterColumn<DateTime>(name: "CreatedAt", table: table,
                type: OldType, nullable: false, oldClrType: typeof(DateTime), oldType: NewType);
            migrationBuilder.AlterColumn<DateTime?>(name: "UpdatedAt", table: table,
                type: OldType, nullable: true, oldClrType: typeof(DateTime), oldType: NewType, oldNullable: true);
            migrationBuilder.AlterColumn<DateTime?>(name: "DeletedAt", table: table,
                type: OldType, nullable: true, oldClrType: typeof(DateTime), oldType: NewType, oldNullable: true);

            migrationBuilder.RenameColumn(name: "CreatedAt", table: table, newName: "CreatedAtUtc");
            migrationBuilder.RenameColumn(name: "UpdatedAt", table: table, newName: "UpdatedAtUtc");
            migrationBuilder.RenameColumn(name: "DeletedAt", table: table, newName: "DeletedAtUtc");
        }

        migrationBuilder.AlterColumn<DateTime>(name: "ExpiresAt", table: "RefreshTokens",
            type: OldType, nullable: false, oldClrType: typeof(DateTime), oldType: NewType);
        migrationBuilder.AlterColumn<DateTime?>(name: "RevokedAt", table: "RefreshTokens",
            type: OldType, nullable: true, oldClrType: typeof(DateTime), oldType: NewType, oldNullable: true);
        migrationBuilder.RenameColumn(name: "ExpiresAt", table: "RefreshTokens", newName: "ExpiresAtUtc");
        migrationBuilder.RenameColumn(name: "RevokedAt", table: "RefreshTokens", newName: "RevokedAtUtc");

        migrationBuilder.AlterColumn<DateTime>(name: "GeneratedAt", table: "SessionReports",
            type: OldType, nullable: false, oldClrType: typeof(DateTime), oldType: NewType);
        migrationBuilder.RenameColumn(name: "GeneratedAt", table: "SessionReports", newName: "GeneratedAtUtc");

        migrationBuilder.AlterColumn<DateTime?>(name: "SentAt", table: "NotificationDeliveries",
            type: OldType, nullable: true, oldClrType: typeof(DateTime), oldType: NewType, oldNullable: true);
        migrationBuilder.RenameColumn(name: "SentAt", table: "NotificationDeliveries", newName: "SentAtUtc");
    }
}
