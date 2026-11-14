START TRANSACTION;

ALTER TABLE `employees` ADD `TeamId` int NULL;

CREATE TABLE `teams` (
    `Id` int NOT NULL AUTO_INCREMENT,
    `TeamCode` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
    `TeamName` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
    `DepartmentId` int NOT NULL,
    `Description` varchar(500) CHARACTER SET utf8mb4 NULL,
    `IsActive` tinyint(1) NOT NULL,
    `CreatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_teams` PRIMARY KEY (`Id`),
    CONSTRAINT `AK_teams_Id_DepartmentId` UNIQUE (`Id`, `DepartmentId`),
    CONSTRAINT `FK_teams_departments_DepartmentId` FOREIGN KEY (`DepartmentId`) REFERENCES `departments` (`Id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE INDEX `IX_employees_TeamId_DepartmentId` ON `employees` (`TeamId`, `DepartmentId`);

CREATE INDEX `IX_teams_DepartmentId_IsActive` ON `teams` (`DepartmentId`, `IsActive`);

CREATE UNIQUE INDEX `IX_teams_TeamCode` ON `teams` (`TeamCode`);

ALTER TABLE `employees` ADD CONSTRAINT `FK_employees_teams_TeamId_DepartmentId` FOREIGN KEY (`TeamId`, `DepartmentId`) REFERENCES `teams` (`Id`, `DepartmentId`) ON DELETE RESTRICT;

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20261114092818_AddTeamsAndEmployeeTeam', '8.0.13');

COMMIT;

