START TRANSACTION;

ALTER TABLE `users` ADD `auth_version` bigint NOT NULL DEFAULT 0;

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20261026065757_AddUserAuthVersion', '8.0.13');

COMMIT;

