-- READ ONLY: inspect before applying the reviewed migration. No DDL/DML.
SELECT DATABASE() AS database_name, VERSION() AS mysql_version,
       @@collation_database AS database_collation,
       @@default_collation_for_utf8mb4 AS utf8mb4_default_collation;

SELECT MigrationId, ProductVersion
FROM __EFMigrationsHistory ORDER BY MigrationId;

SELECT TABLE_NAME, ENGINE, TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('notifications', 'notification_targets', 'notification_recipients',
                     'notification_outbox', 'role_screen_actions', 'screens', 'users', 'roles')
ORDER BY TABLE_NAME;

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA,
       CHARACTER_SET_NAME, COLLATION_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (TABLE_NAME IN ('notifications', 'notification_targets', 'notification_recipients',
                      'notification_outbox', 'role_screen_actions', 'screens')
       OR (TABLE_NAME = 'users' AND COLUMN_NAME = 'user_id')
       OR (TABLE_NAME = 'roles' AND COLUMN_NAME = 'id'))
ORDER BY TABLE_NAME, ORDINAL_POSITION;

SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('notifications', 'notification_targets', 'notification_recipients',
                     'notification_outbox', 'role_screen_actions', 'screens', 'users', 'roles')
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
  AND TABLE_NAME IN ('notifications', 'notification_targets', 'notification_recipients',
                     'notification_outbox', 'role_screen_actions', 'screens')
ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION;

SELECT COUNT(*) AS notification_count FROM notifications;
