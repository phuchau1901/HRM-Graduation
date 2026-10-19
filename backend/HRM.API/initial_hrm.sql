CREATE TABLE IF NOT EXISTS `__EFMigrationsHistory` (
    `MigrationId` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
    `ProductVersion` varchar(32) CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK___EFMigrationsHistory` PRIMARY KEY (`MigrationId`)
) CHARACTER SET=utf8mb4;

START TRANSACTION;

ALTER DATABASE CHARACTER SET utf8mb4;

CREATE TABLE `departments` (
    `Id` int NOT NULL AUTO_INCREMENT,
    `DepartmentCode` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `DepartmentName` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
    `Description` varchar(500) CHARACTER SET utf8mb4 NULL,
    `IsActive` tinyint(1) NOT NULL,
    `CreatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_departments` PRIMARY KEY (`Id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `kpi_templates` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `code` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
    `name` varchar(200) CHARACTER SET utf8mb4 NOT NULL,
    `period_type` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `status` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK_kpi_templates` PRIMARY KEY (`id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `leave_types` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `code` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
    `name` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `paid` tinyint(1) NOT NULL DEFAULT FALSE,
    `requires_balance` tinyint(1) NOT NULL DEFAULT TRUE,
    CONSTRAINT `PK_leave_types` PRIMARY KEY (`id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `positions` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `code` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
    `name` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
    `is_active` tinyint(1) NOT NULL DEFAULT TRUE,
    CONSTRAINT `PK_positions` PRIMARY KEY (`id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `qr_sessions` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `location_code` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
    `nonce_hash` char(64) CHARACTER SET utf8mb4 NOT NULL,
    `valid_from` datetime(6) NOT NULL,
    `expires_at` datetime(6) NOT NULL,
    `status` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK_qr_sessions` PRIMARY KEY (`id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `roles` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `code` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
    `name` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK_roles` PRIMARY KEY (`id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `screens` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `code` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `name` varchar(200) CHARACTER SET utf8mb4 NOT NULL,
    `platform` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `route` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `icon` varchar(100) CHARACTER SET utf8mb4 NULL,
    `parent_id` bigint NULL,
    `sort_order` int NOT NULL,
    `is_active` tinyint(1) NOT NULL DEFAULT TRUE,
    `supported_actions` json NOT NULL,
    CONSTRAINT `PK_screens` PRIMARY KEY (`id`),
    CONSTRAINT `FK_screens_screens_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `screens` (`id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `shifts` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `code` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
    `name` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `start_time` time NOT NULL,
    `end_time` time NOT NULL,
    `break_minutes` int NOT NULL DEFAULT 0,
    `late_grace_minutes` int NOT NULL DEFAULT 0,
    `is_active` tinyint(1) NOT NULL DEFAULT TRUE,
    CONSTRAINT `PK_shifts` PRIMARY KEY (`id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `employees` (
    `Id` int NOT NULL AUTO_INCREMENT,
    `EmployeeCode` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `FullName` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
    `Email` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `DateOfBirth` date NULL,
    `PhoneNumber` varchar(20) CHARACTER SET utf8mb4 NULL,
    `HireDate` date NOT NULL,
    `DepartmentId` int NOT NULL,
    `EmploymentStatus` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `CreatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_employees` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_employees_departments_DepartmentId` FOREIGN KEY (`DepartmentId`) REFERENCES `departments` (`Id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `kpi_criteria` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `template_id` bigint NOT NULL,
    `code` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
    `name` varchar(200) CHARACTER SET utf8mb4 NOT NULL,
    `weight_percent` decimal(5,2) NOT NULL,
    `max_score` decimal(8,2) NOT NULL,
    CONSTRAINT `PK_kpi_criteria` PRIMARY KEY (`id`),
    CONSTRAINT `fk_kpi_criteria_template_id` FOREIGN KEY (`template_id`) REFERENCES `kpi_templates` (`id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `role_details` (
    `role_id` bigint NOT NULL,
    `screen_id` bigint NOT NULL,
    `can_new` varchar(1) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'N',
    `can_view` varchar(1) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'N',
    `can_update` varchar(1) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'N',
    `can_delete` varchar(1) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'N',
    `can_approve` varchar(1) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'N',
    `can_export` varchar(1) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'N',
    CONSTRAINT `PK_role_details` PRIMARY KEY (`role_id`, `screen_id`),
    CONSTRAINT `FK_role_details_roles_role_id` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
    CONSTRAINT `FK_role_details_screens_screen_id` FOREIGN KEY (`screen_id`) REFERENCES `screens` (`id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `contracts` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `employee_id` int NOT NULL,
    `contract_no` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
    `contract_type` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
    `start_date` date NOT NULL,
    `end_date` date NULL,
    `status` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `attachment_url` varchar(500) CHARACTER SET utf8mb4 NULL,
    CONSTRAINT `PK_contracts` PRIMARY KEY (`id`),
    CONSTRAINT `fk_contracts_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`Id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `leave_balances` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `employee_id` int NOT NULL,
    `leave_type_id` bigint NOT NULL,
    `year_no` smallint NOT NULL,
    `entitled_days` decimal(7,2) NOT NULL DEFAULT 0.0,
    `used_days` decimal(7,2) NOT NULL DEFAULT 0.0,
    `reserved_days` decimal(7,2) NOT NULL DEFAULT 0.0,
    CONSTRAINT `PK_leave_balances` PRIMARY KEY (`id`),
    CONSTRAINT `fk_leave_balances_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_leave_balances_leave_type_id` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `leave_requests` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `employee_id` int NOT NULL,
    `leave_type_id` bigint NOT NULL,
    `from_date` date NOT NULL,
    `to_date` date NOT NULL,
    `requested_days` decimal(7,2) NOT NULL,
    `reason` varchar(1000) CHARACTER SET utf8mb4 NULL,
    `status` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `created_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_leave_requests` PRIMARY KEY (`id`),
    CONSTRAINT `fk_leave_requests_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_leave_requests_leave_type_id` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `overtime_requests` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `employee_id` int NOT NULL,
    `start_at` datetime(6) NOT NULL,
    `end_at` datetime(6) NOT NULL,
    `requested_hours` decimal(8,2) NOT NULL,
    `approved_hours` decimal(8,2) NULL,
    `status` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK_overtime_requests` PRIMARY KEY (`id`),
    CONSTRAINT `fk_overtime_requests_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`Id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `salary_profiles` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `employee_id` int NOT NULL,
    `base_salary` decimal(18,2) NOT NULL,
    `allowance_amount` decimal(18,2) NOT NULL DEFAULT 0.0,
    `effective_from` date NOT NULL,
    `effective_to` date NULL,
    `currency_code` char(3) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'VND',
    CONSTRAINT `PK_salary_profiles` PRIMARY KEY (`id`),
    CONSTRAINT `fk_salary_profiles_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`Id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `users` (
    `user_id` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `email` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `employee_id` int NULL,
    `password_hash` varchar(500) CHARACTER SET utf8mb4 NOT NULL,
    `salt` varchar(44) CHARACTER SET utf8mb4 NULL,
    `status` varchar(20) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'ACTIVE',
    `created_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_users` PRIMARY KEY (`user_id`),
    CONSTRAINT `fk_users_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`Id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `work_schedules` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `employee_id` int NOT NULL,
    `shift_id` bigint NOT NULL,
    `work_date` date NOT NULL,
    `status` varchar(20) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'SCHEDULED',
    `unique_work_key` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK_work_schedules` PRIMARY KEY (`id`),
    CONSTRAINT `fk_work_schedules_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_work_schedules_shift_id` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `approval_requests` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `request_type` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
    `reference_id` bigint NOT NULL,
    `requested_by_user_id` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `status` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `created_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_approval_requests` PRIMARY KEY (`id`),
    CONSTRAINT `fk_approval_requests_requested_by_user_id` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `audit_logs` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `actor_user_id` varchar(100) CHARACTER SET utf8mb4 NULL,
    `action` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `entity_type` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `entity_id` varchar(60) CHARACTER SET utf8mb4 NOT NULL,
    `before_json` json NULL,
    `after_json` json NULL,
    `created_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_audit_logs` PRIMARY KEY (`id`),
    CONSTRAINT `fk_audit_logs_actor_user_id` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `employee_histories` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `employee_id` int NOT NULL,
    `old_department_id` int NULL,
    `new_department_id` int NULL,
    `old_position_id` bigint NULL,
    `new_position_id` bigint NULL,
    `effective_date` date NOT NULL,
    `reason` varchar(500) CHARACTER SET utf8mb4 NULL,
    `changed_by_user_id` varchar(100) CHARACTER SET utf8mb4 NULL,
    CONSTRAINT `PK_employee_histories` PRIMARY KEY (`id`),
    CONSTRAINT `fk_employee_histories_changed_by_user_id` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_employee_histories_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_employee_histories_new_department_id` FOREIGN KEY (`new_department_id`) REFERENCES `departments` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_employee_histories_new_position_id` FOREIGN KEY (`new_position_id`) REFERENCES `positions` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_employee_histories_old_department_id` FOREIGN KEY (`old_department_id`) REFERENCES `departments` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_employee_histories_old_position_id` FOREIGN KEY (`old_position_id`) REFERENCES `positions` (`id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `kpi_targets` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `employee_id` int NOT NULL,
    `template_id` bigint NOT NULL,
    `period_key` varchar(7) CHARACTER SET utf8mb4 NOT NULL,
    `status` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `assigned_by_user_id` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK_kpi_targets` PRIMARY KEY (`id`),
    CONSTRAINT `fk_kpi_targets_assigned_by_user_id` FOREIGN KEY (`assigned_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_kpi_targets_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_kpi_targets_template_id` FOREIGN KEY (`template_id`) REFERENCES `kpi_templates` (`id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `notifications` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `user_id` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `title` varchar(200) CHARACTER SET utf8mb4 NOT NULL,
    `content` varchar(1000) CHARACTER SET utf8mb4 NOT NULL,
    `is_read` tinyint(1) NOT NULL DEFAULT FALSE,
    `created_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_notifications` PRIMARY KEY (`id`),
    CONSTRAINT `fk_notifications_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `refresh_tokens` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `user_id` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `token_hash` char(64) CHARACTER SET utf8mb4 NOT NULL,
    `expires_at` datetime(6) NOT NULL,
    `revoked_at` datetime(6) NULL,
    `created_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_refresh_tokens` PRIMARY KEY (`id`),
    CONSTRAINT `fk_refresh_tokens_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `timesheet_periods` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `period_key` char(7) CHARACTER SET utf8mb4 NOT NULL,
    `status` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `closed_at` datetime(6) NULL,
    `closed_by_user_id` varchar(100) CHARACTER SET utf8mb4 NULL,
    CONSTRAINT `PK_timesheet_periods` PRIMARY KEY (`id`),
    CONSTRAINT `fk_timesheet_periods_closed_by_user_id` FOREIGN KEY (`closed_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `user_roles` (
    `user_id` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `role_id` bigint NOT NULL,
    CONSTRAINT `PK_user_roles` PRIMARY KEY (`user_id`, `role_id`),
    CONSTRAINT `fk_user_roles_role_id` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_user_roles_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `attendances` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `schedule_id` bigint NOT NULL,
    `check_in_at` datetime(6) NULL,
    `check_out_at` datetime(6) NULL,
    `check_in_qr_id` bigint NULL,
    `check_out_qr_id` bigint NULL,
    `late_minutes` int NOT NULL DEFAULT 0,
    `early_minutes` int NOT NULL DEFAULT 0,
    `status` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK_attendances` PRIMARY KEY (`id`),
    CONSTRAINT `fk_attendances_check_in_qr_id` FOREIGN KEY (`check_in_qr_id`) REFERENCES `qr_sessions` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_attendances_check_out_qr_id` FOREIGN KEY (`check_out_qr_id`) REFERENCES `qr_sessions` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_attendances_schedule_id` FOREIGN KEY (`schedule_id`) REFERENCES `work_schedules` (`id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `approval_steps` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `approval_request_id` bigint NOT NULL,
    `step_no` int NOT NULL,
    `approver_user_id` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `decision` varchar(20) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'PENDING',
    `comment` varchar(1000) CHARACTER SET utf8mb4 NULL,
    `decided_at` datetime(6) NULL,
    CONSTRAINT `PK_approval_steps` PRIMARY KEY (`id`),
    CONSTRAINT `fk_approval_steps_approval_request_id` FOREIGN KEY (`approval_request_id`) REFERENCES `approval_requests` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_approval_steps_approver_user_id` FOREIGN KEY (`approver_user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `kpi_results` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `target_id` bigint NOT NULL,
    `criterion_id` bigint NOT NULL,
    `self_score` decimal(8,2) NULL,
    `manager_score` decimal(8,2) NULL,
    `comment` varchar(1000) CHARACTER SET utf8mb4 NULL,
    CONSTRAINT `PK_kpi_results` PRIMARY KEY (`id`),
    CONSTRAINT `fk_kpi_results_criterion_id` FOREIGN KEY (`criterion_id`) REFERENCES `kpi_criteria` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_kpi_results_target_id` FOREIGN KEY (`target_id`) REFERENCES `kpi_targets` (`id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `performance_reviews` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `target_id` bigint NOT NULL,
    `final_score` decimal(8,2) NOT NULL,
    `rating` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
    `reviewed_by_user_id` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `reviewed_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_performance_reviews` PRIMARY KEY (`id`),
    CONSTRAINT `fk_performance_reviews_reviewed_by_user_id` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_performance_reviews_target_id` FOREIGN KEY (`target_id`) REFERENCES `kpi_targets` (`id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `payroll_periods` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `period_key` char(7) CHARACTER SET utf8mb4 NOT NULL,
    `timesheet_period_id` bigint NOT NULL,
    `status` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `approved_by_user_id` varchar(100) CHARACTER SET utf8mb4 NULL,
    `published_at` datetime(6) NULL,
    CONSTRAINT `PK_payroll_periods` PRIMARY KEY (`id`),
    CONSTRAINT `fk_payroll_periods_approved_by_user_id` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_payroll_periods_timesheet_period_id` FOREIGN KEY (`timesheet_period_id`) REFERENCES `timesheet_periods` (`id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `timesheet_details` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `period_id` bigint NOT NULL,
    `employee_id` int NOT NULL,
    `worked_days` decimal(7,2) NOT NULL DEFAULT 0.0,
    `paid_leave_days` decimal(7,2) NOT NULL DEFAULT 0.0,
    `overtime_hours` decimal(9,2) NOT NULL DEFAULT 0.0,
    `late_minutes` int NOT NULL DEFAULT 0,
    `calculated_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_timesheet_details` PRIMARY KEY (`id`),
    CONSTRAINT `fk_timesheet_details_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_timesheet_details_period_id` FOREIGN KEY (`period_id`) REFERENCES `timesheet_periods` (`id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `attendance_adjustments` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `attendance_id` bigint NOT NULL,
    `employee_id` int NOT NULL,
    `proposed_check_in` datetime(6) NULL,
    `proposed_check_out` datetime(6) NULL,
    `reason` varchar(1000) CHARACTER SET utf8mb4 NOT NULL,
    `status` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK_attendance_adjustments` PRIMARY KEY (`id`),
    CONSTRAINT `fk_attendance_adjustments_attendance_id` FOREIGN KEY (`attendance_id`) REFERENCES `attendances` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_attendance_adjustments_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`Id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `attendance_requests` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `employee_id` int NOT NULL,
    `request_key` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `attendance_id` bigint NULL,
    `operation` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `created_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_attendance_requests` PRIMARY KEY (`id`),
    CONSTRAINT `fk_attendance_requests_attendance_id` FOREIGN KEY (`attendance_id`) REFERENCES `attendances` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_attendance_requests_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`Id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `payroll_details` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `payroll_period_id` bigint NOT NULL,
    `employee_id` int NOT NULL,
    `base_salary` decimal(18,2) NOT NULL,
    `allowances` decimal(18,2) NOT NULL DEFAULT 0.0,
    `overtime_pay` decimal(18,2) NOT NULL DEFAULT 0.0,
    `kpi_bonus` decimal(18,2) NOT NULL DEFAULT 0.0,
    `deductions` decimal(18,2) NOT NULL DEFAULT 0.0,
    `net_salary` decimal(18,2) NOT NULL,
    `calculation_snapshot` json NOT NULL,
    CONSTRAINT `PK_payroll_details` PRIMARY KEY (`id`),
    CONSTRAINT `fk_payroll_details_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_payroll_details_payroll_period_id` FOREIGN KEY (`payroll_period_id`) REFERENCES `payroll_periods` (`id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE INDEX `IX_approval_requests_requested_by_user_id` ON `approval_requests` (`requested_by_user_id`);

CREATE INDEX `IX_approval_steps_approval_request_id` ON `approval_steps` (`approval_request_id`);

CREATE INDEX `IX_approval_steps_approver_user_id` ON `approval_steps` (`approver_user_id`);

CREATE INDEX `IX_attendance_adjustments_attendance_id` ON `attendance_adjustments` (`attendance_id`);

CREATE INDEX `IX_attendance_adjustments_employee_id` ON `attendance_adjustments` (`employee_id`);

CREATE INDEX `IX_attendance_requests_attendance_id` ON `attendance_requests` (`attendance_id`);

CREATE INDEX `IX_attendance_requests_employee_id` ON `attendance_requests` (`employee_id`);

CREATE UNIQUE INDEX `uq_attendance_requests_request_key` ON `attendance_requests` (`request_key`);

CREATE INDEX `IX_attendances_check_in_qr_id` ON `attendances` (`check_in_qr_id`);

CREATE INDEX `IX_attendances_check_out_qr_id` ON `attendances` (`check_out_qr_id`);

CREATE UNIQUE INDEX `uq_attendances_schedule_id` ON `attendances` (`schedule_id`);

CREATE INDEX `IX_audit_logs_actor_user_id` ON `audit_logs` (`actor_user_id`);

CREATE INDEX `IX_contracts_employee_id` ON `contracts` (`employee_id`);

CREATE UNIQUE INDEX `uq_contracts_contract_no` ON `contracts` (`contract_no`);

CREATE UNIQUE INDEX `IX_departments_DepartmentCode` ON `departments` (`DepartmentCode`);

CREATE INDEX `IX_employee_histories_changed_by_user_id` ON `employee_histories` (`changed_by_user_id`);

CREATE INDEX `IX_employee_histories_employee_id` ON `employee_histories` (`employee_id`);

CREATE INDEX `IX_employee_histories_new_department_id` ON `employee_histories` (`new_department_id`);

CREATE INDEX `IX_employee_histories_new_position_id` ON `employee_histories` (`new_position_id`);

CREATE INDEX `IX_employee_histories_old_department_id` ON `employee_histories` (`old_department_id`);

CREATE INDEX `IX_employee_histories_old_position_id` ON `employee_histories` (`old_position_id`);

CREATE INDEX `IX_employees_DepartmentId` ON `employees` (`DepartmentId`);

CREATE UNIQUE INDEX `IX_employees_Email` ON `employees` (`Email`);

CREATE UNIQUE INDEX `IX_employees_EmployeeCode` ON `employees` (`EmployeeCode`);

CREATE INDEX `IX_kpi_criteria_template_id` ON `kpi_criteria` (`template_id`);

CREATE INDEX `IX_kpi_results_criterion_id` ON `kpi_results` (`criterion_id`);

CREATE INDEX `IX_kpi_results_target_id` ON `kpi_results` (`target_id`);

CREATE INDEX `IX_kpi_targets_assigned_by_user_id` ON `kpi_targets` (`assigned_by_user_id`);

CREATE INDEX `IX_kpi_targets_employee_id` ON `kpi_targets` (`employee_id`);

CREATE INDEX `IX_kpi_targets_template_id` ON `kpi_targets` (`template_id`);

CREATE UNIQUE INDEX `uq_kpi_templates_code` ON `kpi_templates` (`code`);

CREATE INDEX `IX_leave_balances_employee_id` ON `leave_balances` (`employee_id`);

CREATE INDEX `IX_leave_balances_leave_type_id` ON `leave_balances` (`leave_type_id`);

CREATE INDEX `IX_leave_requests_employee_id` ON `leave_requests` (`employee_id`);

CREATE INDEX `IX_leave_requests_leave_type_id` ON `leave_requests` (`leave_type_id`);

CREATE UNIQUE INDEX `uq_leave_types_code` ON `leave_types` (`code`);

CREATE INDEX `IX_notifications_user_id` ON `notifications` (`user_id`);

CREATE INDEX `IX_overtime_requests_employee_id` ON `overtime_requests` (`employee_id`);

CREATE INDEX `IX_payroll_details_employee_id` ON `payroll_details` (`employee_id`);

CREATE INDEX `IX_payroll_details_payroll_period_id` ON `payroll_details` (`payroll_period_id`);

CREATE INDEX `IX_payroll_periods_approved_by_user_id` ON `payroll_periods` (`approved_by_user_id`);

CREATE INDEX `IX_payroll_periods_timesheet_period_id` ON `payroll_periods` (`timesheet_period_id`);

CREATE UNIQUE INDEX `uq_payroll_periods_period_key` ON `payroll_periods` (`period_key`);

CREATE INDEX `IX_performance_reviews_reviewed_by_user_id` ON `performance_reviews` (`reviewed_by_user_id`);

CREATE UNIQUE INDEX `uq_performance_reviews_target_id` ON `performance_reviews` (`target_id`);

CREATE UNIQUE INDEX `uq_positions_code` ON `positions` (`code`);

CREATE UNIQUE INDEX `uq_qr_sessions_nonce_hash` ON `qr_sessions` (`nonce_hash`);

CREATE INDEX `IX_refresh_tokens_user_id` ON `refresh_tokens` (`user_id`);

CREATE UNIQUE INDEX `uq_refresh_tokens_token_hash` ON `refresh_tokens` (`token_hash`);

CREATE INDEX `IX_role_details_screen_id` ON `role_details` (`screen_id`);

CREATE UNIQUE INDEX `uq_roles_code` ON `roles` (`code`);

CREATE INDEX `IX_salary_profiles_employee_id` ON `salary_profiles` (`employee_id`);

CREATE UNIQUE INDEX `IX_screens_code` ON `screens` (`code`);

CREATE INDEX `IX_screens_parent_id` ON `screens` (`parent_id`);

CREATE UNIQUE INDEX `uq_shifts_code` ON `shifts` (`code`);

CREATE INDEX `IX_timesheet_details_employee_id` ON `timesheet_details` (`employee_id`);

CREATE INDEX `IX_timesheet_details_period_id` ON `timesheet_details` (`period_id`);

CREATE INDEX `IX_timesheet_periods_closed_by_user_id` ON `timesheet_periods` (`closed_by_user_id`);

CREATE UNIQUE INDEX `uq_timesheet_periods_period_key` ON `timesheet_periods` (`period_key`);

CREATE INDEX `IX_user_roles_role_id` ON `user_roles` (`role_id`);

CREATE UNIQUE INDEX `uq_users_email` ON `users` (`email`);

CREATE UNIQUE INDEX `uq_users_employee_id` ON `users` (`employee_id`);

CREATE INDEX `IX_work_schedules_employee_id` ON `work_schedules` (`employee_id`);

CREATE INDEX `IX_work_schedules_shift_id` ON `work_schedules` (`shift_id`);

CREATE UNIQUE INDEX `uq_work_schedules_unique_work_key` ON `work_schedules` (`unique_work_key`);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20261019074710_InitialHRMDatabase', '8.0.13');

COMMIT;

