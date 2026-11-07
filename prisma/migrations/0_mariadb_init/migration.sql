-- Migration: 0_mariadb_init
-- Database: MariaDB / MySQL (EduTaktis SaaS Foundation — InnoDB Relational Integrity)
-- Target Hosting: Rumahweb Shared Hosting Medium (app.edutaktis.com)

-- 1. Create Users Table
CREATE TABLE `users` (
    `id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `nama_lengkap` VARCHAR(255) NOT NULL,
    `gelar_depan` VARCHAR(50) NULL,
    `gelar_belakang` VARCHAR(50) NULL,
    `nip` VARCHAR(30) NULL,
    `nuptk` VARCHAR(30) NULL,
    `nomor_telepon` VARCHAR(30) NULL,
    `foto_profil_url` TEXT NULL,
    `preferensi_mata_pelajaran` VARCHAR(150) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `email_verified` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB;

-- 2. Create Institutions Table (Tenant)
CREATE TABLE `institutions` (
    `id` VARCHAR(36) NOT NULL,
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
    `logo_url` TEXT NULL,
    `nama_kepala` VARCHAR(255) NULL,
    `nip_kepala` VARCHAR(30) NULL,
    `kota_tanda_tangan` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `institutions_npsn_key`(`npsn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB;

-- 3. Create Institution Memberships Table (User <-> Institution Relation & Role)
CREATE TABLE `institution_memberships` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `institution_id` VARCHAR(36) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'SCHOOL_ADMIN', 'HEADMASTER', 'TEACHER', 'OPERATOR') NOT NULL DEFAULT 'TEACHER',
    `status` ENUM('ACTIVE', 'PENDING', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `institution_memberships_institution_id_idx`(`institution_id`),
    INDEX `institution_memberships_user_id_idx`(`user_id`),
    UNIQUE INDEX `institution_memberships_user_id_institution_id_key`(`user_id`, `institution_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB;

-- 4. Create Projects Table (Scoped to Institution & Owner User)
CREATE TABLE `projects` (
    `id` VARCHAR(36) NOT NULL,
    `institution_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `master_input` JSON NOT NULL,
    `documents` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `projects_institution_id_idx`(`institution_id`),
    INDEX `projects_user_id_idx`(`user_id`),
    INDEX `projects_user_id_institution_id_idx`(`user_id`, `institution_id`),
    INDEX `projects_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB;

-- 5. Create Audit Logs Table
CREATE TABLE `audit_logs` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `institution_id` VARCHAR(36) NULL,
    `action` VARCHAR(100) NOT NULL,
    `resource` VARCHAR(100) NOT NULL,
    `details` JSON NULL,
    `ip_address` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_institution_id_idx`(`institution_id`),
    INDEX `audit_logs_user_id_idx`(`user_id`),
    INDEX `audit_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB;

-- 6. Create User Sessions Table
CREATE TABLE `user_sessions` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `ip_address` VARCHAR(50) NULL,
    `user_agent` TEXT NULL,
    `last_used_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_sessions_token_hash_key`(`token_hash`),
    INDEX `user_sessions_user_id_idx`(`user_id`),
    INDEX `user_sessions_token_hash_idx`(`token_hash`),
    INDEX `user_sessions_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB;

-- 7. Create Password Reset Tokens Table
CREATE TABLE `password_reset_tokens` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_token_hash_key`(`token_hash`),
    INDEX `password_reset_tokens_user_id_idx`(`user_id`),
    INDEX `password_reset_tokens_token_hash_idx`(`token_hash`),
    INDEX `password_reset_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB;

-- 8. Foreign Key Constraints (InnoDB Engine)
ALTER TABLE `institution_memberships` ADD CONSTRAINT `institution_memberships_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `institution_memberships` ADD CONSTRAINT `institution_memberships_institution_id_fkey` FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `projects` ADD CONSTRAINT `projects_institution_id_fkey` FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `projects` ADD CONSTRAINT `projects_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- CRITICAL MULTI-TENANT COMPOSITE FOREIGN KEY ON MARIADB/MYSQL INNODB
ALTER TABLE `projects` ADD CONSTRAINT `projects_user_id_institution_id_fkey` FOREIGN KEY (`user_id`, `institution_id`) REFERENCES `institution_memberships`(`user_id`, `institution_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_institution_id_fkey` FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
