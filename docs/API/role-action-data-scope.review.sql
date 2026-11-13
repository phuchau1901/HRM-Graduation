-- REVIEW ONLY. Not executed. No grant backfill and no ALL default.
ALTER TABLE `role_screen_actions` ADD `data_scope` varchar(20) NULL;
-- EF records 20261113000000_AddRoleScreenActionDataScope in __EFMigrationsHistory when approved/applied.
-- Rollback (destructive to scope metadata):
-- ALTER TABLE `role_screen_actions` DROP COLUMN `data_scope`;
