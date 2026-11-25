using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRM.API.Migrations
{
    /// <inheritdoc />
    public partial class AddUnscheduledAttendanceEvidence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "unscheduled_attendance_id",
                table: "attendance_requests",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "unscheduled_attendances",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    open_employee_key = table.Column<int>(type: "int", nullable: true),
                    start_at_utc = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    end_at_utc = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    settings_snapshot_json = table.Column<string>(type: "json", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    check_in_qr_id = table.Column<long>(type: "bigint", nullable: true),
                    check_out_qr_id = table.Column<long>(type: "bigint", nullable: true),
                    overtime_request_id = table.Column<long>(type: "bigint", nullable: true),
                    approval_id = table.Column<long>(type: "bigint", nullable: true),
                    recorded_by_user_id = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_unscheduled_attendances", x => x.id);
                    table.ForeignKey(
                        name: "FK_unscheduled_attendances_approval_requests_approval_id",
                        column: x => x.approval_id,
                        principalTable: "approval_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_unscheduled_attendances_employees_employee_id",
                        column: x => x.employee_id,
                        principalTable: "employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_unscheduled_attendances_overtime_requests_overtime_request_id",
                        column: x => x.overtime_request_id,
                        principalTable: "overtime_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_unscheduled_attendances_qr_sessions_check_in_qr_id",
                        column: x => x.check_in_qr_id,
                        principalTable: "qr_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_unscheduled_attendances_qr_sessions_check_out_qr_id",
                        column: x => x.check_out_qr_id,
                        principalTable: "qr_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_unscheduled_attendances_users_recorded_by_user_id",
                        column: x => x.recorded_by_user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_requests_unscheduled_attendance_id",
                table: "attendance_requests",
                column: "unscheduled_attendance_id");

            migrationBuilder.CreateIndex(
                name: "IX_unscheduled_attendances_approval_id",
                table: "unscheduled_attendances",
                column: "approval_id");

            migrationBuilder.CreateIndex(
                name: "IX_unscheduled_attendances_check_in_qr_id",
                table: "unscheduled_attendances",
                column: "check_in_qr_id");

            migrationBuilder.CreateIndex(
                name: "IX_unscheduled_attendances_check_out_qr_id",
                table: "unscheduled_attendances",
                column: "check_out_qr_id");

            migrationBuilder.CreateIndex(
                name: "IX_unscheduled_attendances_employee_id_start_at_utc",
                table: "unscheduled_attendances",
                columns: new[] { "employee_id", "start_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_unscheduled_attendances_open_employee_key",
                table: "unscheduled_attendances",
                column: "open_employee_key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_unscheduled_attendances_overtime_request_id",
                table: "unscheduled_attendances",
                column: "overtime_request_id");

            migrationBuilder.CreateIndex(
                name: "IX_unscheduled_attendances_recorded_by_user_id",
                table: "unscheduled_attendances",
                column: "recorded_by_user_id");

            migrationBuilder.AddForeignKey(
                name: "FK_attendance_requests_unscheduled_attendances_unscheduled_atte~",
                table: "attendance_requests",
                column: "unscheduled_attendance_id",
                principalTable: "unscheduled_attendances",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_attendance_requests_unscheduled_attendances_unscheduled_atte~",
                table: "attendance_requests");

            migrationBuilder.DropTable(
                name: "unscheduled_attendances");

            migrationBuilder.DropIndex(
                name: "IX_attendance_requests_unscheduled_attendance_id",
                table: "attendance_requests");

            migrationBuilder.DropColumn(
                name: "unscheduled_attendance_id",
                table: "attendance_requests");
        }
    }
}
