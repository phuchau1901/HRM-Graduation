using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRM.API.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationCenter : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_notifications_user_id",
                table: "notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_screens_screens_parent_id",
                table: "screens");

            migrationBuilder.DropIndex(
                name: "IX_screens_parent_id",
                table: "screens");

            migrationBuilder.DropIndex(
                name: "IX_notifications_user_id",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "parent_id",
                table: "screens");

            migrationBuilder.DropColumn(
                name: "route",
                table: "screens");

            migrationBuilder.DropColumn(
                name: "sort_order",
                table: "screens");

            migrationBuilder.DropColumn(
                name: "supported_actions",
                table: "screens");

            migrationBuilder.DropColumn(
                name: "is_read",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "user_id",
                table: "notifications");

            migrationBuilder.AddColumn<DateTime>(
                name: "cancelled_at",
                table: "notifications",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "created_by_user_id",
                table: "notifications",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "deduplication_key",
                table: "notifications",
                type: "varchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "published_at",
                table: "notifications",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "recipient_count",
                table: "notifications",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "reference_id",
                table: "notifications",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "reference_type",
                table: "notifications",
                type: "varchar(60)",
                maxLength: 60,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "request_hash",
                table: "notifications",
                type: "varchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "scheduled_at",
                table: "notifications",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source",
                table: "notifications",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "status",
                table: "notifications",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "trace_id",
                table: "notifications",
                type: "varchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "notification_outbox",
                columns: table => new
                {
                    notification_id = table.Column<long>(type: "bigint", nullable: false),
                    status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    available_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    attempts = table.Column<int>(type: "int", nullable: false),
                    lease_token = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    locked_until = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    last_error_code = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notification_outbox", x => x.notification_id);
                    table.ForeignKey(
                        name: "FK_notification_outbox_notifications_notification_id",
                        column: x => x.notification_id,
                        principalTable: "notifications",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "notification_recipients",
                columns: table => new
                {
                    notification_id = table.Column<long>(type: "bigint", nullable: false),
                    user_id = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    read_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    delivery_status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    delivery_attempts = table.Column<int>(type: "int", nullable: false),
                    next_attempt_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    sent_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    event_id = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    lease_token = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    locked_until = table.Column<DateTime>(type: "datetime(6)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notification_recipients", x => new { x.notification_id, x.user_id });
                    table.ForeignKey(
                        name: "FK_notification_recipients_notifications_notification_id",
                        column: x => x.notification_id,
                        principalTable: "notifications",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_notification_recipients_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "notification_targets",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    notification_id = table.Column<long>(type: "bigint", nullable: false),
                    target_type = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    criteria_json = table.Column<string>(type: "json", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notification_targets", x => x.id);
                    table.ForeignKey(
                        name: "FK_notification_targets_notifications_notification_id",
                        column: x => x.notification_id,
                        principalTable: "notifications",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "role_screen_actions",
                columns: table => new
                {
                    role_id = table.Column<long>(type: "bigint", nullable: false),
                    screen_id = table.Column<long>(type: "bigint", nullable: false),
                    action_code = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_role_screen_actions", x => new { x.role_id, x.screen_id, x.action_code });
                    table.ForeignKey(
                        name: "FK_role_screen_actions_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_role_screen_actions_screens_screen_id",
                        column: x => x.screen_id,
                        principalTable: "screens",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_notifications_created_by_user_id",
                table: "notifications",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_notifications_deduplication_key",
                table: "notifications",
                column: "deduplication_key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_notifications_status_scheduled_at",
                table: "notifications",
                columns: new[] { "status", "scheduled_at" });

            migrationBuilder.CreateIndex(
                name: "IX_notification_outbox_status_available_at_locked_until",
                table: "notification_outbox",
                columns: new[] { "status", "available_at", "locked_until" });

            migrationBuilder.CreateIndex(
                name: "IX_notification_recipients_delivery_status_next_attempt_at_lock~",
                table: "notification_recipients",
                columns: new[] { "delivery_status", "next_attempt_at", "locked_until" });

            migrationBuilder.CreateIndex(
                name: "IX_notification_recipients_user_id_read_at_notification_id",
                table: "notification_recipients",
                columns: new[] { "user_id", "read_at", "notification_id" });

            migrationBuilder.CreateIndex(
                name: "IX_notification_targets_notification_id",
                table: "notification_targets",
                column: "notification_id");

            migrationBuilder.CreateIndex(
                name: "IX_role_screen_actions_screen_id",
                table: "role_screen_actions",
                column: "screen_id");

            migrationBuilder.AddForeignKey(
                name: "FK_notifications_users_created_by_user_id",
                table: "notifications",
                column: "created_by_user_id",
                principalTable: "users",
                principalColumn: "user_id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_notifications_users_created_by_user_id",
                table: "notifications");

            migrationBuilder.DropTable(
                name: "notification_outbox");

            migrationBuilder.DropTable(
                name: "notification_recipients");

            migrationBuilder.DropTable(
                name: "notification_targets");

            migrationBuilder.DropTable(
                name: "role_screen_actions");

            migrationBuilder.DropIndex(
                name: "IX_notifications_created_by_user_id",
                table: "notifications");

            migrationBuilder.DropIndex(
                name: "IX_notifications_deduplication_key",
                table: "notifications");

            migrationBuilder.DropIndex(
                name: "IX_notifications_status_scheduled_at",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "cancelled_at",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "created_by_user_id",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "deduplication_key",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "published_at",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "recipient_count",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "reference_id",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "reference_type",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "request_hash",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "scheduled_at",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "source",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "status",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "trace_id",
                table: "notifications");

            migrationBuilder.AddColumn<long>(
                name: "parent_id",
                table: "screens",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "route",
                table: "screens",
                type: "varchar(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "sort_order",
                table: "screens",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "supported_actions",
                table: "screens",
                type: "json",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "is_read",
                table: "notifications",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "user_id",
                table: "notifications",
                type: "varchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_screens_parent_id",
                table: "screens",
                column: "parent_id");

            migrationBuilder.CreateIndex(
                name: "IX_notifications_user_id",
                table: "notifications",
                column: "user_id");

            migrationBuilder.AddForeignKey(
                name: "fk_notifications_user_id",
                table: "notifications",
                column: "user_id",
                principalTable: "users",
                principalColumn: "user_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_screens_screens_parent_id",
                table: "screens",
                column: "parent_id",
                principalTable: "screens",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
