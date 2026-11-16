using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRM.API.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationManagers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LeadEmployeeId",
                table: "teams",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ManagerEmployeeId",
                table: "departments",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_teams_LeadEmployeeId",
                table: "teams",
                column: "LeadEmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_departments_ManagerEmployeeId",
                table: "departments",
                column: "ManagerEmployeeId");

            migrationBuilder.AddForeignKey(
                name: "FK_departments_employees_ManagerEmployeeId",
                table: "departments",
                column: "ManagerEmployeeId",
                principalTable: "employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_teams_employees_LeadEmployeeId",
                table: "teams",
                column: "LeadEmployeeId",
                principalTable: "employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_departments_employees_ManagerEmployeeId",
                table: "departments");

            migrationBuilder.DropForeignKey(
                name: "FK_teams_employees_LeadEmployeeId",
                table: "teams");

            migrationBuilder.DropIndex(
                name: "IX_teams_LeadEmployeeId",
                table: "teams");

            migrationBuilder.DropIndex(
                name: "IX_departments_ManagerEmployeeId",
                table: "departments");

            migrationBuilder.DropColumn(
                name: "LeadEmployeeId",
                table: "teams");

            migrationBuilder.DropColumn(
                name: "ManagerEmployeeId",
                table: "departments");
        }
    }
}
