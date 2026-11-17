using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRM.API.Migrations
{
    /// <inheritdoc />
    public partial class CompleteLeaveApprovalWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "created_at",
                table: "overtime_requests",
                type: "datetime(6)",
                nullable: false,
                defaultValue: new DateTime(1970, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "reason",
                table: "overtime_requests",
                type: "varchar(1000)",
                maxLength: 1000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<long>(
                name: "version",
                table: "overtime_requests",
                type: "bigint",
                nullable: false,
                defaultValue: 1L);

            migrationBuilder.AddColumn<bool>(
                name: "is_active",
                table: "leave_types",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "balance_allocation_json",
                table: "leave_requests",
                type: "varchar(4000)",
                maxLength: 4000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<long>(
                name: "version",
                table: "leave_requests",
                type: "bigint",
                nullable: false,
                defaultValue: 1L);

            migrationBuilder.AddColumn<long>(
                name: "version",
                table: "leave_balances",
                type: "bigint",
                nullable: false,
                defaultValue: 1L);

            migrationBuilder.AddColumn<long>(
                name: "expected_schedule_version",
                table: "attendance_adjustments",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "original_attendance_json",
                table: "attendance_adjustments",
                type: "varchar(4000)",
                maxLength: 4000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<long>(
                name: "version",
                table: "attendance_adjustments",
                type: "bigint",
                nullable: false,
                defaultValue: 1L);

            migrationBuilder.AddColumn<bool>(
                name: "allow_self_approval",
                table: "approval_requests",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "employee_id",
                table: "approval_requests",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "version",
                table: "approval_requests",
                type: "bigint",
                nullable: false,
                defaultValue: 1L);

            migrationBuilder.CreateIndex(
                name: "IX_overtime_requests_employee_id_status_start_at_end_at",
                table: "overtime_requests",
                columns: new[] { "employee_id", "status", "start_at", "end_at" });

            migrationBuilder.CreateIndex(
                name: "IX_leave_requests_employee_id_status_from_date_to_date",
                table: "leave_requests",
                columns: new[] { "employee_id", "status", "from_date", "to_date" });

            migrationBuilder.CreateIndex(
                name: "IX_leave_balances_employee_id_leave_type_id_year_no",
                table: "leave_balances",
                columns: new[] { "employee_id", "leave_type_id", "year_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_attendance_adjustments_attendance_id_status",
                table: "attendance_adjustments",
                columns: new[] { "attendance_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_approval_steps_approval_request_id_step_no",
                table: "approval_steps",
                columns: new[] { "approval_request_id", "step_no" },
                unique: true);

            // Keep a leftmost-prefix index available for each existing MySQL foreign key.
            migrationBuilder.DropIndex(
                name: "IX_overtime_requests_employee_id",
                table: "overtime_requests");

            migrationBuilder.DropIndex(
                name: "IX_leave_requests_employee_id",
                table: "leave_requests");

            migrationBuilder.DropIndex(
                name: "IX_leave_balances_employee_id",
                table: "leave_balances");

            migrationBuilder.DropIndex(
                name: "IX_attendance_adjustments_attendance_id",
                table: "attendance_adjustments");

            migrationBuilder.DropIndex(
                name: "IX_approval_steps_approval_request_id",
                table: "approval_steps");

            migrationBuilder.CreateIndex(
                name: "IX_approval_requests_employee_id_status",
                table: "approval_requests",
                columns: new[] { "employee_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_approval_requests_request_type_reference_id",
                table: "approval_requests",
                columns: new[] { "request_type", "reference_id" });

            migrationBuilder.AddForeignKey(
                name: "FK_approval_requests_employees_employee_id",
                table: "approval_requests",
                column: "employee_id",
                principalTable: "employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_approval_requests_employees_employee_id",
                table: "approval_requests");

            // Restore FK-supporting indexes before dropping their composite replacements.
            migrationBuilder.CreateIndex(
                name: "IX_overtime_requests_employee_id",
                table: "overtime_requests",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_requests_employee_id",
                table: "leave_requests",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_balances_employee_id",
                table: "leave_balances",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_adjustments_attendance_id",
                table: "attendance_adjustments",
                column: "attendance_id");

            migrationBuilder.CreateIndex(
                name: "IX_approval_steps_approval_request_id",
                table: "approval_steps",
                column: "approval_request_id");

            migrationBuilder.DropIndex(
                name: "IX_overtime_requests_employee_id_status_start_at_end_at",
                table: "overtime_requests");

            migrationBuilder.DropIndex(
                name: "IX_leave_requests_employee_id_status_from_date_to_date",
                table: "leave_requests");

            migrationBuilder.DropIndex(
                name: "IX_leave_balances_employee_id_leave_type_id_year_no",
                table: "leave_balances");

            migrationBuilder.DropIndex(
                name: "IX_attendance_adjustments_attendance_id_status",
                table: "attendance_adjustments");

            migrationBuilder.DropIndex(
                name: "IX_approval_steps_approval_request_id_step_no",
                table: "approval_steps");

            migrationBuilder.DropIndex(
                name: "IX_approval_requests_employee_id_status",
                table: "approval_requests");

            migrationBuilder.DropIndex(
                name: "IX_approval_requests_request_type_reference_id",
                table: "approval_requests");

            migrationBuilder.DropColumn(
                name: "created_at",
                table: "overtime_requests");

            migrationBuilder.DropColumn(
                name: "reason",
                table: "overtime_requests");

            migrationBuilder.DropColumn(
                name: "version",
                table: "overtime_requests");

            migrationBuilder.DropColumn(
                name: "is_active",
                table: "leave_types");

            migrationBuilder.DropColumn(
                name: "balance_allocation_json",
                table: "leave_requests");

            migrationBuilder.DropColumn(
                name: "version",
                table: "leave_requests");

            migrationBuilder.DropColumn(
                name: "version",
                table: "leave_balances");

            migrationBuilder.DropColumn(
                name: "expected_schedule_version",
                table: "attendance_adjustments");

            migrationBuilder.DropColumn(
                name: "original_attendance_json",
                table: "attendance_adjustments");

            migrationBuilder.DropColumn(
                name: "version",
                table: "attendance_adjustments");

            migrationBuilder.DropColumn(
                name: "allow_self_approval",
                table: "approval_requests");

            migrationBuilder.DropColumn(
                name: "employee_id",
                table: "approval_requests");

            migrationBuilder.DropColumn(
                name: "version",
                table: "approval_requests");


        }
    }
}
