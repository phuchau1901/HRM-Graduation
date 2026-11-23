START TRANSACTION;

INSERT INTO screens (code, name, platform, is_active) SELECT 'WEB_SALARY_CONFIGURATION', 'Salary Configuration', 'WEB', 1 WHERE NOT EXISTS (SELECT 1 FROM screens WHERE code = 'WEB_SALARY_CONFIGURATION');

INSERT INTO screens (code, name, platform, is_active) SELECT 'WEB_PAYROLL', 'Payroll Management', 'WEB', 1 WHERE NOT EXISTS (SELECT 1 FROM screens WHERE code = 'WEB_PAYROLL');

INSERT INTO screens (code, name, platform, is_active) SELECT 'WEB_MY_PAYSLIPS', 'My Payslips', 'WEB', 1 WHERE NOT EXISTS (SELECT 1 FROM screens WHERE code = 'WEB_MY_PAYSLIPS');

ALTER TABLE `payroll_periods` DROP INDEX `uq_payroll_periods_period_key`;

ALTER TABLE `timesheet_periods` ADD `errors_json` json NULL;

ALTER TABLE `timesheet_periods` ADD `input_hash` varchar(64) CHARACTER SET utf8mb4 NULL;

ALTER TABLE `timesheet_periods` ADD `last_calculation_key` varchar(100) CHARACTER SET utf8mb4 NULL;

ALTER TABLE `timesheet_periods` ADD `version` bigint NOT NULL DEFAULT 1;

ALTER TABLE `timesheet_details` ADD `snapshot_json` json NULL;

ALTER TABLE `timesheet_details` ADD `unique_key` varchar(60) CHARACTER SET utf8mb4 NULL;

ALTER TABLE `salary_profiles` ADD `dependents` int NOT NULL DEFAULT 0;

ALTER TABLE `salary_profiles` ADD `insurance_base` decimal(18,2) NOT NULL DEFAULT 0.0;

ALTER TABLE `salary_profiles` ADD `is_verified` tinyint(1) NOT NULL DEFAULT FALSE;

ALTER TABLE `salary_profiles` ADD `items_json` json NULL;

ALTER TABLE `salary_profiles` ADD `kpi_bonus_amount` decimal(18,2) NOT NULL DEFAULT 0.0;

ALTER TABLE `salary_profiles` ADD `pay_basis` varchar(10) CHARACTER SET utf8mb4 NULL;

ALTER TABLE `salary_profiles` ADD `reason` varchar(1000) CHARACTER SET utf8mb4 NULL;

ALTER TABLE `salary_profiles` ADD `version` bigint NOT NULL DEFAULT 1;

ALTER TABLE `payroll_periods` ADD `approval_id` bigint NULL;

ALTER TABLE `payroll_periods` ADD `calculated_by` varchar(100) CHARACTER SET utf8mb4 NULL;

ALTER TABLE `payroll_periods` ADD `created_by` varchar(100) CHARACTER SET utf8mb4 NULL;

ALTER TABLE `payroll_periods` ADD `department_id` int NULL;

ALTER TABLE `payroll_periods` ADD `errors_json` json NULL;

ALTER TABLE `payroll_periods` ADD `input_hash` varchar(64) CHARACTER SET utf8mb4 NULL;

ALTER TABLE `payroll_periods` ADD `last_calculation_key` varchar(100) CHARACTER SET utf8mb4 NULL;

ALTER TABLE `payroll_periods` ADD `locked_at` datetime(6) NULL;

ALTER TABLE `payroll_periods` ADD `paid_at` datetime(6) NULL;

ALTER TABLE `payroll_periods` ADD `paid_by` varchar(100) CHARACTER SET utf8mb4 NULL;

ALTER TABLE `payroll_periods` ADD `payment_reference` varchar(150) CHARACTER SET utf8mb4 NULL;

ALTER TABLE `payroll_periods` ADD `policy_id` bigint NULL;

ALTER TABLE `payroll_periods` ADD `scope_key` varchar(40) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'ALL';

ALTER TABLE `payroll_periods` ADD `version` bigint NOT NULL DEFAULT 1;

ALTER TABLE `payroll_details` ADD `employee_period_key` varchar(60) CHARACTER SET utf8mb4 NULL;

ALTER TABLE `payroll_details` ADD `employer_insurance` decimal(18,2) NOT NULL DEFAULT 0.0;

ALTER TABLE `payroll_details` ADD `gross_salary` decimal(18,2) NOT NULL DEFAULT 0.0;

ALTER TABLE `payroll_details` ADD `insurance_amount` decimal(18,2) NOT NULL DEFAULT 0.0;

ALTER TABLE `payroll_details` ADD `tax_amount` decimal(18,2) NOT NULL DEFAULT 0.0;

ALTER TABLE `payroll_details` ADD `unique_key` varchar(60) CHARACTER SET utf8mb4 NULL;

CREATE TABLE `payroll_policies` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `code` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
    `name` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
    `effective_from` date NOT NULL,
    `effective_to` date NULL,
    `status` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `rules_json` json NOT NULL,
    `legal_reference` varchar(1000) CHARACTER SET utf8mb4 NOT NULL,
    `version` bigint NOT NULL,
    CONSTRAINT `PK_payroll_policies` PRIMARY KEY (`id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `salary_components` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `code` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
    `name` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
    `kind` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `taxable` tinyint(1) NOT NULL,
    `tax_deductible` tinyint(1) NOT NULL,
    `overtime_included` tinyint(1) NOT NULL,
    `is_active` tinyint(1) NOT NULL,
    `version` bigint NOT NULL,
    CONSTRAINT `PK_salary_components` PRIMARY KEY (`id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `payroll_adjustments` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `payroll_period_id` bigint NOT NULL,
    `employee_id` int NOT NULL,
    `component_id` bigint NOT NULL,
    `amount` decimal(18,2) NOT NULL,
    `reason` varchar(1000) CHARACTER SET utf8mb4 NOT NULL,
    `component_snapshot_json` json NOT NULL,
    `request_key` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `is_cancelled` tinyint(1) NOT NULL,
    `version` bigint NOT NULL,
    `created_by` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `created_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_payroll_adjustments` PRIMARY KEY (`id`),
    CONSTRAINT `FK_payroll_adjustments_employees_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_payroll_adjustments_payroll_periods_payroll_period_id` FOREIGN KEY (`payroll_period_id`) REFERENCES `payroll_periods` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_payroll_adjustments_salary_components_component_id` FOREIGN KEY (`component_id`) REFERENCES `salary_components` (`id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE UNIQUE INDEX `IX_timesheet_details_unique_key` ON `timesheet_details` (`unique_key`);

CREATE INDEX `IX_salary_profiles_employee_id_effective_from` ON `salary_profiles` (`employee_id`, `effective_from`);

CREATE INDEX `IX_payroll_periods_approval_id` ON `payroll_periods` (`approval_id`);

CREATE INDEX `IX_payroll_periods_department_id` ON `payroll_periods` (`department_id`);

CREATE UNIQUE INDEX `IX_payroll_periods_period_key_scope_key` ON `payroll_periods` (`period_key`, `scope_key`);

CREATE INDEX `IX_payroll_periods_policy_id` ON `payroll_periods` (`policy_id`);

CREATE UNIQUE INDEX `IX_payroll_details_employee_period_key` ON `payroll_details` (`employee_period_key`);

CREATE UNIQUE INDEX `IX_payroll_details_unique_key` ON `payroll_details` (`unique_key`);

CREATE INDEX `IX_payroll_adjustments_component_id` ON `payroll_adjustments` (`component_id`);

CREATE INDEX `IX_payroll_adjustments_employee_id` ON `payroll_adjustments` (`employee_id`);

CREATE INDEX `IX_payroll_adjustments_payroll_period_id` ON `payroll_adjustments` (`payroll_period_id`);

CREATE UNIQUE INDEX `IX_payroll_adjustments_request_key` ON `payroll_adjustments` (`request_key`);

CREATE UNIQUE INDEX `IX_payroll_policies_code` ON `payroll_policies` (`code`);

CREATE INDEX `IX_payroll_policies_status_effective_from` ON `payroll_policies` (`status`, `effective_from`);

CREATE UNIQUE INDEX `IX_salary_components_code` ON `salary_components` (`code`);

ALTER TABLE `payroll_periods` ADD CONSTRAINT `FK_payroll_periods_approval_requests_approval_id` FOREIGN KEY (`approval_id`) REFERENCES `approval_requests` (`id`) ON DELETE RESTRICT;

ALTER TABLE `payroll_periods` ADD CONSTRAINT `FK_payroll_periods_departments_department_id` FOREIGN KEY (`department_id`) REFERENCES `departments` (`Id`) ON DELETE RESTRICT;

ALTER TABLE `payroll_periods` ADD CONSTRAINT `FK_payroll_periods_payroll_policies_policy_id` FOREIGN KEY (`policy_id`) REFERENCES `payroll_policies` (`id`) ON DELETE RESTRICT;

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20261123171325_CompletePayrollCompensation', '8.0.13');

COMMIT;

