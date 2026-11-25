START TRANSACTION;

ALTER TABLE `attendance_requests` ADD `unscheduled_attendance_id` bigint NULL;

CREATE TABLE `unscheduled_attendances` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `employee_id` int NOT NULL,
    `open_employee_key` int NULL,
    `start_at_utc` datetime(6) NOT NULL,
    `end_at_utc` datetime(6) NULL,
    `status` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `settings_snapshot_json` json NOT NULL,
    `check_in_qr_id` bigint NULL,
    `check_out_qr_id` bigint NULL,
    `overtime_request_id` bigint NULL,
    `approval_id` bigint NULL,
    `recorded_by_user_id` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `version` bigint NOT NULL,
    CONSTRAINT `PK_unscheduled_attendances` PRIMARY KEY (`id`),
    CONSTRAINT `FK_unscheduled_attendances_approval_requests_approval_id` FOREIGN KEY (`approval_id`) REFERENCES `approval_requests` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_unscheduled_attendances_employees_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_unscheduled_attendances_overtime_requests_overtime_request_id` FOREIGN KEY (`overtime_request_id`) REFERENCES `overtime_requests` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_unscheduled_attendances_qr_sessions_check_in_qr_id` FOREIGN KEY (`check_in_qr_id`) REFERENCES `qr_sessions` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_unscheduled_attendances_qr_sessions_check_out_qr_id` FOREIGN KEY (`check_out_qr_id`) REFERENCES `qr_sessions` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_unscheduled_attendances_users_recorded_by_user_id` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE INDEX `IX_attendance_requests_unscheduled_attendance_id` ON `attendance_requests` (`unscheduled_attendance_id`);

CREATE INDEX `IX_unscheduled_attendances_approval_id` ON `unscheduled_attendances` (`approval_id`);

CREATE INDEX `IX_unscheduled_attendances_check_in_qr_id` ON `unscheduled_attendances` (`check_in_qr_id`);

CREATE INDEX `IX_unscheduled_attendances_check_out_qr_id` ON `unscheduled_attendances` (`check_out_qr_id`);

CREATE INDEX `IX_unscheduled_attendances_employee_id_start_at_utc` ON `unscheduled_attendances` (`employee_id`, `start_at_utc`);

CREATE UNIQUE INDEX `IX_unscheduled_attendances_open_employee_key` ON `unscheduled_attendances` (`open_employee_key`);

CREATE INDEX `IX_unscheduled_attendances_overtime_request_id` ON `unscheduled_attendances` (`overtime_request_id`);

CREATE INDEX `IX_unscheduled_attendances_recorded_by_user_id` ON `unscheduled_attendances` (`recorded_by_user_id`);

ALTER TABLE `attendance_requests` ADD CONSTRAINT `FK_attendance_requests_unscheduled_attendances_unscheduled_atte~` FOREIGN KEY (`unscheduled_attendance_id`) REFERENCES `unscheduled_attendances` (`id`) ON DELETE RESTRICT;

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20261125031533_AddUnscheduledAttendanceEvidence', '8.0.13');

COMMIT;

