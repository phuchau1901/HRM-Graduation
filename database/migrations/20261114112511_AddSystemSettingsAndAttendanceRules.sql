START TRANSACTION;

ALTER TABLE `work_schedules` ADD `rules_snapshot_json` longtext CHARACTER SET utf8mb4 NULL;

ALTER TABLE `work_schedules` ADD `version` bigint NOT NULL DEFAULT 0;

ALTER TABLE `shifts` ADD `version` bigint NOT NULL DEFAULT 0;

CREATE TABLE `password_histories` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `user_id` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `password_hash` varchar(500) CHARACTER SET utf8mb4 NOT NULL,
    `salt` varchar(44) CHARACTER SET utf8mb4 NOT NULL,
    `created_at_utc` datetime(6) NOT NULL,
    CONSTRAINT `PK_password_histories` PRIMARY KEY (`id`),
    CONSTRAINT `FK_password_histories_users_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `system_settings` (
    `setting_key` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
    `json_value` longtext CHARACTER SET utf8mb4 NOT NULL,
    `version` bigint NOT NULL,
    `updated_at_utc` datetime(6) NOT NULL,
    CONSTRAINT `PK_system_settings` PRIMARY KEY (`setting_key`)
) CHARACTER SET=utf8mb4;

INSERT INTO `system_settings` (`setting_key`, `json_value`, `updated_at_utc`, `version`)
VALUES ('ATTENDANCE', '{"timezone":"Asia/Ho_Chi_Minh","checkInBeforeStartMinutes":60,"checkInAfterStartMinutes":240,"checkOutBeforeEndMinutes":240,"checkOutAfterEndMinutes":120,"lateGraceMinutes":5,"earlyLeaveGraceMinutes":5,"workingDays":[1,2,3,4,5],"requireQr":false,"requireGps":false,"allowOvernightShifts":true,"missingPunchRule":"REJECT_CHECKOUT_WITHOUT_CHECKIN","locations":[]}', TIMESTAMP '2026-11-14 00:00:00', 1),
('PASSWORD_POLICY', '{"minimumLength":12,"maximumLength":128,"requireUppercase":false,"requireLowercase":false,"requireDigit":false,"requireSpecialCharacter":false,"disallowUsernameInPassword":false,"passwordHistoryCount":0}', TIMESTAMP '2026-11-14 00:00:00', 1);

CREATE INDEX `IX_work_schedules_employee_id_work_date` ON `work_schedules` (`employee_id`, `work_date`);

ALTER TABLE `work_schedules` DROP INDEX `IX_work_schedules_employee_id`;

CREATE INDEX `IX_password_histories_user_id_id` ON `password_histories` (`user_id`, `id`);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20261114112511_AddSystemSettingsAndAttendanceRules', '8.0.13');

COMMIT;

