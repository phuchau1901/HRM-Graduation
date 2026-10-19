START TRANSACTION;

ALTER TABLE `notifications` DROP INDEX `IX_notifications_user_id`;

ALTER TABLE `notifications` DROP COLUMN `is_read`;

ALTER TABLE `notifications` DROP COLUMN `user_id`;

ALTER TABLE `notifications` ADD `cancelled_at` datetime(6) NULL;

ALTER TABLE `notifications` ADD `created_by_user_id` varchar(100) CHARACTER SET utf8mb4 NULL;

ALTER TABLE `notifications` ADD `deduplication_key` varchar(64) CHARACTER SET utf8mb4 NOT NULL DEFAULT '';

ALTER TABLE `notifications` ADD `published_at` datetime(6) NULL;

ALTER TABLE `notifications` ADD `recipient_count` int NOT NULL DEFAULT 0;

ALTER TABLE `notifications` ADD `reference_id` varchar(100) CHARACTER SET utf8mb4 NULL;

ALTER TABLE `notifications` ADD `reference_type` varchar(60) CHARACTER SET utf8mb4 NULL;

ALTER TABLE `notifications` ADD `request_hash` varchar(64) CHARACTER SET utf8mb4 NOT NULL DEFAULT '';

ALTER TABLE `notifications` ADD `scheduled_at` datetime(6) NULL;

ALTER TABLE `notifications` ADD `source` varchar(20) CHARACTER SET utf8mb4 NOT NULL DEFAULT '';

ALTER TABLE `notifications` ADD `status` varchar(20) CHARACTER SET utf8mb4 NOT NULL DEFAULT '';

ALTER TABLE `notifications` ADD `trace_id` varchar(64) CHARACTER SET utf8mb4 NOT NULL DEFAULT '';

CREATE TABLE `notification_outbox` (
    `notification_id` bigint NOT NULL,
    `status` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `available_at` datetime(6) NOT NULL,
    `attempts` int NOT NULL,
    `lease_token` varchar(32) CHARACTER SET utf8mb4 NULL,
    `locked_until` datetime(6) NULL,
    `last_error_code` varchar(40) CHARACTER SET utf8mb4 NULL,
    CONSTRAINT `PK_notification_outbox` PRIMARY KEY (`notification_id`),
    CONSTRAINT `FK_notification_outbox_notifications_notification_id` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `notification_recipients` (
    `notification_id` bigint NOT NULL,
    `user_id` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `created_at` datetime(6) NOT NULL,
    `read_at` datetime(6) NULL,
    `delivery_status` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `delivery_attempts` int NOT NULL,
    `next_attempt_at` datetime(6) NOT NULL,
    `sent_at` datetime(6) NULL,
    `event_id` varchar(32) CHARACTER SET utf8mb4 NOT NULL,
    `lease_token` varchar(32) CHARACTER SET utf8mb4 NULL,
    `locked_until` datetime(6) NULL,
    CONSTRAINT `PK_notification_recipients` PRIMARY KEY (`notification_id`, `user_id`),
    CONSTRAINT `FK_notification_recipients_notifications_notification_id` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_notification_recipients_users_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `notification_targets` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `notification_id` bigint NOT NULL,
    `target_type` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `criteria_json` json NOT NULL,
    CONSTRAINT `PK_notification_targets` PRIMARY KEY (`id`),
    CONSTRAINT `FK_notification_targets_notifications_notification_id` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `role_screen_actions` (
    `role_id` bigint NOT NULL,
    `screen_id` bigint NOT NULL,
    `action_code` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK_role_screen_actions` PRIMARY KEY (`role_id`, `screen_id`, `action_code`),
    CONSTRAINT `FK_role_screen_actions_roles_role_id` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_role_screen_actions_screens_screen_id` FOREIGN KEY (`screen_id`) REFERENCES `screens` (`id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE INDEX `IX_notifications_created_by_user_id` ON `notifications` (`created_by_user_id`);

CREATE UNIQUE INDEX `IX_notifications_deduplication_key` ON `notifications` (`deduplication_key`);

CREATE INDEX `IX_notifications_status_scheduled_at` ON `notifications` (`status`, `scheduled_at`);

CREATE INDEX `IX_notification_outbox_status_available_at_locked_until` ON `notification_outbox` (`status`, `available_at`, `locked_until`);

CREATE INDEX `IX_notification_recipients_delivery_status_next_attempt_at_lock~` ON `notification_recipients` (`delivery_status`, `next_attempt_at`, `locked_until`);

CREATE INDEX `IX_notification_recipients_user_id_read_at_notification_id` ON `notification_recipients` (`user_id`, `read_at`, `notification_id`);

CREATE INDEX `IX_notification_targets_notification_id` ON `notification_targets` (`notification_id`);

CREATE INDEX `IX_role_screen_actions_screen_id` ON `role_screen_actions` (`screen_id`);

ALTER TABLE `notifications` ADD CONSTRAINT `FK_notifications_users_created_by_user_id` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT;

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20261019145341_AddNotificationCenter', '8.0.13');

COMMIT;

