using Microsoft.EntityFrameworkCore.Migrations;
#nullable disable
namespace HRM.API.Migrations;
public partial class AddRoleScreenActionDataScope : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.AddColumn<string>(
        name: "data_scope", table: "role_screen_actions", type: "varchar(20)", maxLength: 20, nullable: true);
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropColumn(name: "data_scope", table: "role_screen_actions");
}
