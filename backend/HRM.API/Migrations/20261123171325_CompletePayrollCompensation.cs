using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRM.API.Migrations
{
    /// <inheritdoc />
    public partial class CompletePayrollCompensation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("INSERT INTO screens (code, name, platform, is_active) SELECT 'WEB_SALARY_CONFIGURATION', 'Salary Configuration', 'WEB', 1 WHERE NOT EXISTS (SELECT 1 FROM screens WHERE code = 'WEB_SALARY_CONFIGURATION');");
            migrationBuilder.Sql("INSERT INTO screens (code, name, platform, is_active) SELECT 'WEB_PAYROLL', 'Payroll Management', 'WEB', 1 WHERE NOT EXISTS (SELECT 1 FROM screens WHERE code = 'WEB_PAYROLL');");
            migrationBuilder.Sql("INSERT INTO screens (code, name, platform, is_active) SELECT 'WEB_MY_PAYSLIPS', 'My Payslips', 'WEB', 1 WHERE NOT EXISTS (SELECT 1 FROM screens WHERE code = 'WEB_MY_PAYSLIPS');");
            migrationBuilder.DropIndex(
                name: "uq_payroll_periods_period_key",
                table: "payroll_periods");

            migrationBuilder.AddColumn<string>(
                name: "errors_json",
                table: "timesheet_periods",
                type: "json",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "input_hash",
                table: "timesheet_periods",
                type: "varchar(64)",
                maxLength: 64,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "last_calculation_key",
                table: "timesheet_periods",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<long>(
                name: "version",
                table: "timesheet_periods",
                type: "bigint",
                nullable: false,
                defaultValue: 1L);

            migrationBuilder.AddColumn<string>(
                name: "snapshot_json",
                table: "timesheet_details",
                type: "json",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "unique_key",
                table: "timesheet_details",
                type: "varchar(60)",
                maxLength: 60,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "dependents",
                table: "salary_profiles",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "insurance_base",
                table: "salary_profiles",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "is_verified",
                table: "salary_profiles",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "items_json",
                table: "salary_profiles",
                type: "json",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "kpi_bonus_amount",
                table: "salary_profiles",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "pay_basis",
                table: "salary_profiles",
                type: "varchar(10)",
                maxLength: 10,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "reason",
                table: "salary_profiles",
                type: "varchar(1000)",
                maxLength: 1000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<long>(
                name: "version",
                table: "salary_profiles",
                type: "bigint",
                nullable: false,
                defaultValue: 1L);

            migrationBuilder.AddColumn<long>(
                name: "approval_id",
                table: "payroll_periods",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "calculated_by",
                table: "payroll_periods",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "created_by",
                table: "payroll_periods",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "department_id",
                table: "payroll_periods",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "errors_json",
                table: "payroll_periods",
                type: "json",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "input_hash",
                table: "payroll_periods",
                type: "varchar(64)",
                maxLength: 64,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "last_calculation_key",
                table: "payroll_periods",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "locked_at",
                table: "payroll_periods",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "paid_at",
                table: "payroll_periods",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "paid_by",
                table: "payroll_periods",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "payment_reference",
                table: "payroll_periods",
                type: "varchar(150)",
                maxLength: 150,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<long>(
                name: "policy_id",
                table: "payroll_periods",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "scope_key",
                table: "payroll_periods",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "ALL")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<long>(
                name: "version",
                table: "payroll_periods",
                type: "bigint",
                nullable: false,
                defaultValue: 1L);

            migrationBuilder.AddColumn<string>(
                name: "employee_period_key",
                table: "payroll_details",
                type: "varchar(60)",
                maxLength: 60,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "employer_insurance",
                table: "payroll_details",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "gross_salary",
                table: "payroll_details",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "insurance_amount",
                table: "payroll_details",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "tax_amount",
                table: "payroll_details",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "unique_key",
                table: "payroll_details",
                type: "varchar(60)",
                maxLength: 60,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "payroll_policies",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    code = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    name = table.Column<string>(type: "varchar(150)", maxLength: 150, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    effective_to = table.Column<DateOnly>(type: "date", nullable: true),
                    status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    rules_json = table.Column<string>(type: "json", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    legal_reference = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payroll_policies", x => x.id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "salary_components",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    code = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    name = table.Column<string>(type: "varchar(150)", maxLength: 150, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    kind = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    taxable = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    tax_deductible = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    overtime_included = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    is_active = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_salary_components", x => x.id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "payroll_adjustments",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    payroll_period_id = table.Column<long>(type: "bigint", nullable: false),
                    employee_id = table.Column<int>(type: "int", nullable: false),
                    component_id = table.Column<long>(type: "bigint", nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    reason = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    component_snapshot_json = table.Column<string>(type: "json", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    request_key = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    is_cancelled = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_by = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payroll_adjustments", x => x.id);
                    table.ForeignKey(
                        name: "FK_payroll_adjustments_employees_employee_id",
                        column: x => x.employee_id,
                        principalTable: "employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_payroll_adjustments_payroll_periods_payroll_period_id",
                        column: x => x.payroll_period_id,
                        principalTable: "payroll_periods",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_payroll_adjustments_salary_components_component_id",
                        column: x => x.component_id,
                        principalTable: "salary_components",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_timesheet_details_unique_key",
                table: "timesheet_details",
                column: "unique_key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_salary_profiles_employee_id_effective_from",
                table: "salary_profiles",
                columns: new[] { "employee_id", "effective_from" });

            migrationBuilder.CreateIndex(
                name: "IX_payroll_periods_approval_id",
                table: "payroll_periods",
                column: "approval_id");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_periods_department_id",
                table: "payroll_periods",
                column: "department_id");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_periods_period_key_scope_key",
                table: "payroll_periods",
                columns: new[] { "period_key", "scope_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payroll_periods_policy_id",
                table: "payroll_periods",
                column: "policy_id");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_details_employee_period_key",
                table: "payroll_details",
                column: "employee_period_key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payroll_details_unique_key",
                table: "payroll_details",
                column: "unique_key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payroll_adjustments_component_id",
                table: "payroll_adjustments",
                column: "component_id");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_adjustments_employee_id",
                table: "payroll_adjustments",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_adjustments_payroll_period_id",
                table: "payroll_adjustments",
                column: "payroll_period_id");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_adjustments_request_key",
                table: "payroll_adjustments",
                column: "request_key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payroll_policies_code",
                table: "payroll_policies",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payroll_policies_status_effective_from",
                table: "payroll_policies",
                columns: new[] { "status", "effective_from" });

            migrationBuilder.CreateIndex(
                name: "IX_salary_components_code",
                table: "salary_components",
                column: "code",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_payroll_periods_approval_requests_approval_id",
                table: "payroll_periods",
                column: "approval_id",
                principalTable: "approval_requests",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_payroll_periods_departments_department_id",
                table: "payroll_periods",
                column: "department_id",
                principalTable: "departments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_payroll_periods_payroll_policies_policy_id",
                table: "payroll_periods",
                column: "policy_id",
                principalTable: "payroll_policies",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_payroll_periods_approval_requests_approval_id",
                table: "payroll_periods");

            migrationBuilder.DropForeignKey(
                name: "FK_payroll_periods_departments_department_id",
                table: "payroll_periods");

            migrationBuilder.DropForeignKey(
                name: "FK_payroll_periods_payroll_policies_policy_id",
                table: "payroll_periods");

            migrationBuilder.DropTable(
                name: "payroll_adjustments");

            migrationBuilder.DropTable(
                name: "payroll_policies");

            migrationBuilder.DropTable(
                name: "salary_components");

            migrationBuilder.DropIndex(
                name: "IX_timesheet_details_unique_key",
                table: "timesheet_details");

            migrationBuilder.DropIndex(
                name: "IX_salary_profiles_employee_id_effective_from",
                table: "salary_profiles");

            migrationBuilder.DropIndex(
                name: "IX_payroll_periods_approval_id",
                table: "payroll_periods");

            migrationBuilder.DropIndex(
                name: "IX_payroll_periods_department_id",
                table: "payroll_periods");

            migrationBuilder.DropIndex(
                name: "IX_payroll_periods_period_key_scope_key",
                table: "payroll_periods");

            migrationBuilder.DropIndex(
                name: "IX_payroll_periods_policy_id",
                table: "payroll_periods");

            migrationBuilder.DropIndex(
                name: "IX_payroll_details_employee_period_key",
                table: "payroll_details");

            migrationBuilder.DropIndex(
                name: "IX_payroll_details_unique_key",
                table: "payroll_details");

            migrationBuilder.DropColumn(
                name: "errors_json",
                table: "timesheet_periods");

            migrationBuilder.DropColumn(
                name: "input_hash",
                table: "timesheet_periods");

            migrationBuilder.DropColumn(
                name: "last_calculation_key",
                table: "timesheet_periods");

            migrationBuilder.DropColumn(
                name: "version",
                table: "timesheet_periods");

            migrationBuilder.DropColumn(
                name: "snapshot_json",
                table: "timesheet_details");

            migrationBuilder.DropColumn(
                name: "unique_key",
                table: "timesheet_details");

            migrationBuilder.DropColumn(
                name: "dependents",
                table: "salary_profiles");

            migrationBuilder.DropColumn(
                name: "insurance_base",
                table: "salary_profiles");

            migrationBuilder.DropColumn(
                name: "is_verified",
                table: "salary_profiles");

            migrationBuilder.DropColumn(
                name: "items_json",
                table: "salary_profiles");

            migrationBuilder.DropColumn(
                name: "kpi_bonus_amount",
                table: "salary_profiles");

            migrationBuilder.DropColumn(
                name: "pay_basis",
                table: "salary_profiles");

            migrationBuilder.DropColumn(
                name: "reason",
                table: "salary_profiles");

            migrationBuilder.DropColumn(
                name: "version",
                table: "salary_profiles");

            migrationBuilder.DropColumn(
                name: "approval_id",
                table: "payroll_periods");

            migrationBuilder.DropColumn(
                name: "calculated_by",
                table: "payroll_periods");

            migrationBuilder.DropColumn(
                name: "created_by",
                table: "payroll_periods");

            migrationBuilder.DropColumn(
                name: "department_id",
                table: "payroll_periods");

            migrationBuilder.DropColumn(
                name: "errors_json",
                table: "payroll_periods");

            migrationBuilder.DropColumn(
                name: "input_hash",
                table: "payroll_periods");

            migrationBuilder.DropColumn(
                name: "last_calculation_key",
                table: "payroll_periods");

            migrationBuilder.DropColumn(
                name: "locked_at",
                table: "payroll_periods");

            migrationBuilder.DropColumn(
                name: "paid_at",
                table: "payroll_periods");

            migrationBuilder.DropColumn(
                name: "paid_by",
                table: "payroll_periods");

            migrationBuilder.DropColumn(
                name: "payment_reference",
                table: "payroll_periods");

            migrationBuilder.DropColumn(
                name: "policy_id",
                table: "payroll_periods");

            migrationBuilder.DropColumn(
                name: "scope_key",
                table: "payroll_periods");

            migrationBuilder.DropColumn(
                name: "version",
                table: "payroll_periods");

            migrationBuilder.DropColumn(
                name: "employee_period_key",
                table: "payroll_details");

            migrationBuilder.DropColumn(
                name: "employer_insurance",
                table: "payroll_details");

            migrationBuilder.DropColumn(
                name: "gross_salary",
                table: "payroll_details");

            migrationBuilder.DropColumn(
                name: "insurance_amount",
                table: "payroll_details");

            migrationBuilder.DropColumn(
                name: "tax_amount",
                table: "payroll_details");

            migrationBuilder.DropColumn(
                name: "unique_key",
                table: "payroll_details");

            migrationBuilder.CreateIndex(
                name: "uq_payroll_periods_period_key",
                table: "payroll_periods",
                column: "period_key",
                unique: true);
        }
    }
}
