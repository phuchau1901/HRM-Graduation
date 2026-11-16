using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRM.API.Migrations
{
    /// <inheritdoc />
    public partial class AddContractTypeCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "contract_types",
                columns: table => new
                {
                    code = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    name = table.Column<string>(type: "varchar(150)", maxLength: 150, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    description = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    is_active = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_contract_types", x => x.code);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_contracts_contract_type",
                table: "contracts",
                column: "contract_type");

            migrationBuilder.CreateIndex(
                name: "IX_contract_types_is_active_sort_order",
                table: "contract_types",
                columns: new[] { "is_active", "sort_order" });

            // Preserve every legacy code before enforcing the catalog reference.
            // This inserts catalog rows only; existing contracts are never rewritten.
            migrationBuilder.Sql(@"INSERT INTO `contract_types` (`code`, `name`, `is_active`, `sort_order`)
SELECT DISTINCT `contract_type`, `contract_type`, 1, 0 FROM `contracts`
WHERE `contract_type` IS NOT NULL;");

            migrationBuilder.AddForeignKey(
                name: "FK_contracts_contract_types_contract_type",
                table: "contracts",
                column: "contract_type",
                principalTable: "contract_types",
                principalColumn: "code",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_contracts_contract_types_contract_type",
                table: "contracts");

            migrationBuilder.DropTable(
                name: "contract_types");

            migrationBuilder.DropIndex(
                name: "IX_contracts_contract_type",
                table: "contracts");
        }
    }
}
