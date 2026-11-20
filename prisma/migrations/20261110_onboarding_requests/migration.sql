-- EduTaktis ONBOARDING migration
-- Target: MySQL 8.x / InnoDB
-- Scope:
-- 1. Align updated_at columns with Prisma @updatedAt.
-- 2. Create institution_requests and its relations.
--
-- IMPORTANT:
-- This file is prepared for review only.
-- Do not execute against any database before approval.

-- =========================================================
-- 1. Align existing updated_at columns
-- Remove database-level ON UPDATE behavior.
-- Prisma Client manages @updatedAt.
-- =========================================================

ALTER TABLE `users`
  MODIFY COLUMN `updated_at`
  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE `institutions`
  MODIFY COLUMN `updated_at`
  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE `institution_memberships`
  MODIFY COLUMN `updated_at`
  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE `projects`
  MODIFY COLUMN `updated_at`
  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);


-- =========================================================
-- 2. Create institution_requests
-- =========================================================

CREATE TABLE `institution_requests` (
  `id` VARCHAR(36) NOT NULL,
  `requester_user_id` VARCHAR(36) NOT NULL,

  `npsn` VARCHAR(20) NOT NULL,
  `nama_resmi` VARCHAR(255) NOT NULL,
  `nama_singkat` VARCHAR(100) NOT NULL,
  `jenjang` VARCHAR(20) NOT NULL,
  `jenis_institusi` VARCHAR(20) NOT NULL,
  `kementerian_dinas` VARCHAR(255) NOT NULL,
  `alamat_lengkap` TEXT NOT NULL,
  `kelurahan_desa` VARCHAR(100) NULL,
  `kecamatan` VARCHAR(100) NULL,
  `kabupaten_kota` VARCHAR(100) NOT NULL,
  `provinsi` VARCHAR(100) NOT NULL,
  `kode_pos` VARCHAR(20) NULL,
  `telepon` VARCHAR(50) NULL,
  `email` VARCHAR(255) NULL,
  `website` VARCHAR(255) NULL,

  `status` ENUM(
    'PENDING_REVIEW',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'PENDING_REVIEW',

  `institution_id` VARCHAR(36) NULL,
  `reviewed_by` VARCHAR(36) NULL,
  `reviewed_at` DATETIME(3) NULL,
  `rejection_reason` TEXT NULL,

  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `institution_requests_institution_id_key`
    (`institution_id`),

  INDEX `institution_requests_requester_user_id_status_idx`
    (`requester_user_id`, `status`),

  INDEX `institution_requests_npsn_status_idx`
    (`npsn`, `status`),

  INDEX `institution_requests_status_created_at_idx`
    (`status`, `created_at`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci
  ENGINE = InnoDB;


-- =========================================================
-- 3. Foreign key constraints
-- =========================================================

ALTER TABLE `institution_requests`
  ADD CONSTRAINT `institution_requests_requester_user_id_fkey`
  FOREIGN KEY (`requester_user_id`)
  REFERENCES `users`(`id`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE `institution_requests`
  ADD CONSTRAINT `institution_requests_reviewed_by_fkey`
  FOREIGN KEY (`reviewed_by`)
  REFERENCES `users`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE `institution_requests`
  ADD CONSTRAINT `institution_requests_institution_id_fkey`
  FOREIGN KEY (`institution_id`)
  REFERENCES `institutions`(`id`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

