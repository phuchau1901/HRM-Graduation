using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRM.API.Migrations
{
    /// <inheritdoc />
    public partial class CompletePerformanceManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.AddColumn<int>(
                name: "department_id",
                table: "kpi_templates",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "position_id",
                table: "kpi_templates",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "team_id",
                table: "kpi_templates",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "version",
                table: "kpi_templates",
                type: "bigint",
                nullable: false,
                defaultValue: 1L);

            migrationBuilder.AddColumn<long>(
                name: "approval_id",
                table: "kpi_targets",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "final_score",
                table: "kpi_targets",
                type: "decimal(8,2)",
                precision: 8,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "period_id",
                table: "kpi_targets",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "reviewer_comment",
                table: "kpi_targets",
                type: "varchar(1000)",
                maxLength: 1000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "reviewer_employee_id",
                table: "kpi_targets",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "snapshot_json",
                table: "kpi_targets",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "submitted_at",
                table: "kpi_targets",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "version",
                table: "kpi_targets",
                type: "bigint",
                nullable: false,
                defaultValue: 1L);

            migrationBuilder.AddColumn<decimal>(
                name: "actual_value",
                table: "kpi_results",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "evidence_url",
                table: "kpi_results",
                type: "varchar(2000)",
                maxLength: 2000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<long>(
                name: "metric_id",
                table: "kpi_criteria",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "metric_snapshot_json",
                table: "kpi_criteria",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "target_value",
                table: "kpi_criteria",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "kpi_metrics",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    code = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    name = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    unit = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    direction = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    method = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    source = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    max_score = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: false),
                    milestones_json = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    is_active = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kpi_metrics", x => x.id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "kpi_periods",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    code = table.Column<string>(type: "varchar(7)", maxLength: 7, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    period_type = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    start_date = table.Column<DateOnly>(type: "date", nullable: false),
                    end_date = table.Column<DateOnly>(type: "date", nullable: false),
                    is_closed = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    closed_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    closed_by = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kpi_periods", x => x.id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_kpi_templates_department_id",
                table: "kpi_templates",
                column: "department_id");

            migrationBuilder.CreateIndex(
                name: "IX_kpi_templates_position_id",
                table: "kpi_templates",
                column: "position_id");

            migrationBuilder.CreateIndex(
                name: "IX_kpi_templates_team_id",
                table: "kpi_templates",
                column: "team_id");

            migrationBuilder.CreateIndex(
                name: "IX_kpi_targets_approval_id",
                table: "kpi_targets",
                column: "approval_id");

            migrationBuilder.CreateIndex(
                name: "IX_kpi_targets_employee_id_period_id",
                table: "kpi_targets",
                columns: new[] { "employee_id", "period_id" },
                unique: true);

            // Preserve a supporting index for the employee FK throughout the migration.
            migrationBuilder.DropIndex(
                name: "IX_kpi_targets_employee_id",
                table: "kpi_targets");

            migrationBuilder.CreateIndex(
                name: "IX_kpi_targets_period_id_status",
                table: "kpi_targets",
                columns: new[] { "period_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_kpi_targets_reviewer_employee_id",
                table: "kpi_targets",
                column: "reviewer_employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_kpi_criteria_metric_id",
                table: "kpi_criteria",
                column: "metric_id");

            migrationBuilder.CreateIndex(
                name: "IX_kpi_metrics_code",
                table: "kpi_metrics",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_kpi_periods_code",
                table: "kpi_periods",
                column: "code",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_kpi_criteria_kpi_metrics_metric_id",
                table: "kpi_criteria",
                column: "metric_id",
                principalTable: "kpi_metrics",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_kpi_targets_approval_requests_approval_id",
                table: "kpi_targets",
                column: "approval_id",
                principalTable: "approval_requests",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_kpi_targets_employees_reviewer_employee_id",
                table: "kpi_targets",
                column: "reviewer_employee_id",
                principalTable: "employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_kpi_targets_kpi_periods_period_id",
                table: "kpi_targets",
                column: "period_id",
                principalTable: "kpi_periods",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_kpi_templates_departments_department_id",
                table: "kpi_templates",
                column: "department_id",
                principalTable: "departments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_kpi_templates_positions_position_id",
                table: "kpi_templates",
                column: "position_id",
                principalTable: "positions",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_kpi_templates_teams_team_id",
                table: "kpi_templates",
                column: "team_id",
                principalTable: "teams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
            // Register screens only; administrators explicitly assign grants and scopes.
            migrationBuilder.Sql("INSERT INTO screens (code, name, platform, is_active) SELECT 'WEB_KPI_CONFIGURATION', 'KPI Configuration', 'WEB', 1 WHERE NOT EXISTS (SELECT 1 FROM screens WHERE code = 'WEB_KPI_CONFIGURATION');");
            migrationBuilder.Sql("INSERT INTO screens (code, name, platform, is_active) SELECT 'WEB_KPI_EVALUATION', 'KPI Evaluation', 'WEB', 1 WHERE NOT EXISTS (SELECT 1 FROM screens WHERE code = 'WEB_KPI_EVALUATION');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_kpi_targets_employee_id",
                table: "kpi_targets",
                column: "employee_id");

            migrationBuilder.DropForeignKey(
                name: "FK_kpi_criteria_kpi_metrics_metric_id",
                table: "kpi_criteria");

            migrationBuilder.DropForeignKey(
                name: "FK_kpi_targets_approval_requests_approval_id",
                table: "kpi_targets");

            migrationBuilder.DropForeignKey(
                name: "FK_kpi_targets_employees_reviewer_employee_id",
                table: "kpi_targets");

            migrationBuilder.DropForeignKey(
                name: "FK_kpi_targets_kpi_periods_period_id",
                table: "kpi_targets");

            migrationBuilder.DropForeignKey(
                name: "FK_kpi_templates_departments_department_id",
                table: "kpi_templates");

            migrationBuilder.DropForeignKey(
                name: "FK_kpi_templates_positions_position_id",
                table: "kpi_templates");

            migrationBuilder.DropForeignKey(
                name: "FK_kpi_templates_teams_team_id",
                table: "kpi_templates");

            migrationBuilder.DropTable(
                name: "kpi_metrics");

            migrationBuilder.DropTable(
                name: "kpi_periods");

            migrationBuilder.DropIndex(
                name: "IX_kpi_templates_department_id",
                table: "kpi_templates");

            migrationBuilder.DropIndex(
                name: "IX_kpi_templates_position_id",
                table: "kpi_templates");

            migrationBuilder.DropIndex(
                name: "IX_kpi_templates_team_id",
                table: "kpi_templates");

            migrationBuilder.DropIndex(
                name: "IX_kpi_targets_approval_id",
                table: "kpi_targets");

            migrationBuilder.DropIndex(
                name: "IX_kpi_targets_employee_id_period_id",
                table: "kpi_targets");

            migrationBuilder.DropIndex(
                name: "IX_kpi_targets_period_id_status",
                table: "kpi_targets");

            migrationBuilder.DropIndex(
                name: "IX_kpi_targets_reviewer_employee_id",
                table: "kpi_targets");

            migrationBuilder.DropIndex(
                name: "IX_kpi_criteria_metric_id",
                table: "kpi_criteria");

            migrationBuilder.DropColumn(
                name: "department_id",
                table: "kpi_templates");

            migrationBuilder.DropColumn(
                name: "position_id",
                table: "kpi_templates");

            migrationBuilder.DropColumn(
                name: "team_id",
                table: "kpi_templates");

            migrationBuilder.DropColumn(
                name: "version",
                table: "kpi_templates");

            migrationBuilder.DropColumn(
                name: "approval_id",
                table: "kpi_targets");

            migrationBuilder.DropColumn(
                name: "final_score",
                table: "kpi_targets");

            migrationBuilder.DropColumn(
                name: "period_id",
                table: "kpi_targets");

            migrationBuilder.DropColumn(
                name: "reviewer_comment",
                table: "kpi_targets");

            migrationBuilder.DropColumn(
                name: "reviewer_employee_id",
                table: "kpi_targets");

            migrationBuilder.DropColumn(
                name: "snapshot_json",
                table: "kpi_targets");

            migrationBuilder.DropColumn(
                name: "submitted_at",
                table: "kpi_targets");

            migrationBuilder.DropColumn(
                name: "version",
                table: "kpi_targets");

            migrationBuilder.DropColumn(
                name: "actual_value",
                table: "kpi_results");

            migrationBuilder.DropColumn(
                name: "evidence_url",
                table: "kpi_results");

            migrationBuilder.DropColumn(
                name: "metric_id",
                table: "kpi_criteria");

            migrationBuilder.DropColumn(
                name: "metric_snapshot_json",
                table: "kpi_criteria");

            migrationBuilder.DropColumn(
                name: "target_value",
                table: "kpi_criteria");

        }
    }
}
