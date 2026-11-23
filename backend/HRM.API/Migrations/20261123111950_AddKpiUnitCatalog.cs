using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace HRM.API.Migrations
{
    /// <inheritdoc />
    public partial class AddKpiUnitCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "unit_id",
                table: "kpi_metrics",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "kpi_units",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    code = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    is_active = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kpi_units", x => x.id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.InsertData(
                table: "kpi_units",
                columns: new[] { "id", "code", "is_active", "name", "sort_order", "version" },
                values: new object[,]
                {
                    { 1L, "%", true, "Phần trăm (%)", 1, 1L },
                    { 2L, "VND", true, "Tiền (VND)", 2, 1L },
                    { 3L, "Điểm", true, "Điểm", 3, 1L },
                    { 4L, "Số lượng", true, "Số lượng", 4, 1L },
                    { 5L, "Giờ", true, "Giờ", 5, 1L },
                    { 6L, "Ngày", true, "Ngày", 6, 1L },
                    { 7L, "Lần", true, "Lần", 7, 1L },
                    { 8L, "Sản phẩm", true, "Sản phẩm", 8, 1L },
                    { 9L, "Công việc", true, "Công việc", 9, 1L },
                    { 10L, "Khách hàng", true, "Khách hàng", 10, 1L },
                    { 11L, "Hợp đồng", true, "Hợp đồng", 11, 1L }
                });

            migrationBuilder.CreateIndex(
                name: "IX_kpi_metrics_unit_id",
                table: "kpi_metrics",
                column: "unit_id");

            migrationBuilder.CreateIndex(
                name: "IX_kpi_units_code",
                table: "kpi_units",
                column: "code",
                unique: true);

            // Import existing codes into the new catalog only; do not rewrite metric values or snapshots.
            // IGNORE handles old codes differing only by case/collation from the seeded codes.
            migrationBuilder.Sql("INSERT IGNORE INTO kpi_units (code, name, is_active, sort_order, version) SELECT DISTINCT unit, unit, 1, 1000, 1 FROM kpi_metrics WHERE unit IS NOT NULL AND CHAR_LENGTH(TRIM(unit)) > 0;");

            migrationBuilder.AddForeignKey(
                name: "FK_kpi_metrics_kpi_units_unit_id",
                table: "kpi_metrics",
                column: "unit_id",
                principalTable: "kpi_units",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_kpi_metrics_kpi_units_unit_id",
                table: "kpi_metrics");

            migrationBuilder.DropTable(
                name: "kpi_units");

            migrationBuilder.DropIndex(
                name: "IX_kpi_metrics_unit_id",
                table: "kpi_metrics");

            migrationBuilder.DropColumn(
                name: "unit_id",
                table: "kpi_metrics");
        }
    }
}
