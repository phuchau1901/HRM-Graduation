using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace HRM.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSystemSettingsAndAttendanceRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "rules_snapshot_json",
                table: "work_schedules",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<long>(
                name: "version",
                table: "work_schedules",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "version",
                table: "shifts",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateTable(
                name: "password_histories",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    user_id = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    password_hash = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    salt = table.Column<string>(type: "varchar(44)", maxLength: 44, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    created_at_utc = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_password_histories", x => x.id);
                    table.ForeignKey(
                        name: "FK_password_histories_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "system_settings",
                columns: table => new
                {
                    setting_key = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    json_value = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_system_settings", x => x.setting_key);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.InsertData(
                table: "system_settings",
                columns: new[] { "setting_key", "json_value", "updated_at_utc", "version" },
                values: new object[,]
                {
                    { "ATTENDANCE", "{\"timezone\":\"Asia/Ho_Chi_Minh\",\"checkInBeforeStartMinutes\":60,\"checkInAfterStartMinutes\":240,\"checkOutBeforeEndMinutes\":240,\"checkOutAfterEndMinutes\":120,\"lateGraceMinutes\":5,\"earlyLeaveGraceMinutes\":5,\"workingDays\":[1,2,3,4,5],\"requireQr\":false,\"requireGps\":false,\"allowOvernightShifts\":true,\"missingPunchRule\":\"REJECT_CHECKOUT_WITHOUT_CHECKIN\",\"locations\":[]}", new DateTime(2026, 11, 14, 0, 0, 0, 0, DateTimeKind.Utc), 1L },
                    { "PASSWORD_POLICY", "{\"minimumLength\":12,\"maximumLength\":128,\"requireUppercase\":false,\"requireLowercase\":false,\"requireDigit\":false,\"requireSpecialCharacter\":false,\"disallowUsernameInPassword\":false,\"passwordHistoryCount\":0}", new DateTime(2026, 11, 14, 0, 0, 0, 0, DateTimeKind.Utc), 1L }
                });

            migrationBuilder.CreateIndex(
                name: "IX_work_schedules_employee_id_work_date",
                table: "work_schedules",
                columns: new[] { "employee_id", "work_date" });

            // MySQL needs a supporting index throughout the FK replacement.
            migrationBuilder.DropIndex(
                name: "IX_work_schedules_employee_id",
                table: "work_schedules");

            migrationBuilder.CreateIndex(
                name: "IX_password_histories_user_id_id",
                table: "password_histories",
                columns: new[] { "user_id", "id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "password_histories");

            migrationBuilder.DropTable(
                name: "system_settings");

            migrationBuilder.CreateIndex(
                name: "IX_work_schedules_employee_id",
                table: "work_schedules",
                column: "employee_id");

            migrationBuilder.DropIndex(
                name: "IX_work_schedules_employee_id_work_date",
                table: "work_schedules");

            migrationBuilder.DropColumn(
                name: "rules_snapshot_json",
                table: "work_schedules");

            migrationBuilder.DropColumn(
                name: "version",
                table: "work_schedules");

            migrationBuilder.DropColumn(
                name: "version",
                table: "shifts");

        }
    }
}
