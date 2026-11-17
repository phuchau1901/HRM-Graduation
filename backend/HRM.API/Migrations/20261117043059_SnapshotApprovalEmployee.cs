using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRM.API.Migrations
{
    /// <inheritdoc />
    public partial class SnapshotApprovalEmployee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "approver_employee_id",
                table: "approval_steps",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_approval_steps_approver_employee_id",
                table: "approval_steps",
                column: "approver_employee_id");

            migrationBuilder.AddForeignKey(
                name: "FK_approval_steps_employees_approver_employee_id",
                table: "approval_steps",
                column: "approver_employee_id",
                principalTable: "employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_approval_steps_employees_approver_employee_id",
                table: "approval_steps");

            migrationBuilder.DropIndex(
                name: "IX_approval_steps_approver_employee_id",
                table: "approval_steps");

            migrationBuilder.DropColumn(
                name: "approver_employee_id",
                table: "approval_steps");
        }
    }
}
