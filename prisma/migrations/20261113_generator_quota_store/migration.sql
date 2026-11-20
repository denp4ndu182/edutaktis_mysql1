-- EduTaktis B12 Generator Quota Store
-- Target: MySQL 8.4 / InnoDB
-- Scope: Create two new tables only.
-- No modification to existing tables.

CREATE TABLE `generator_usage_counters` (
  `id` VARCHAR(36) NOT NULL,
  `scope` ENUM('IP', 'USER') NOT NULL,
  `key_hash` CHAR(64)
    CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `window_seconds` INT UNSIGNED NOT NULL,
  `window_start` DATETIME(3) NOT NULL,
  `window_end` DATETIME(3) NOT NULL,
  `usage_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `generator_usage_counters_window_key`
    (`scope`, `key_hash`, `window_seconds`, `window_start`),

  INDEX `generator_usage_counters_window_end_idx`
    (`window_end`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  ENGINE = InnoDB;

CREATE TABLE `generator_execution_locks` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `owner_token` CHAR(64)
    CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `acquired_at` DATETIME(3) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `generator_execution_locks_user_id_key`
    (`user_id`),

  INDEX `generator_execution_locks_expires_at_idx`
    (`expires_at`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  ENGINE = InnoDB;

ALTER TABLE `generator_execution_locks`
  ADD CONSTRAINT `generator_execution_locks_user_id_fkey`
  FOREIGN KEY (`user_id`)
  REFERENCES `users` (`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;
