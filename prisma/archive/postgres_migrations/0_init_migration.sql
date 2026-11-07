-- ARCHIVED POSTGRESQL MIGRATION 0_INIT
-- Database: PostgreSQL (EduTaktis SaaS Foundation — Hardened Relational Integrity)

CREATE TYPE "InstitutionRole" AS ENUM ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'HEADMASTER', 'TEACHER', 'OPERATOR');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'PENDING', 'INACTIVE');

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "nama_lengkap" VARCHAR(255) NOT NULL,
    "gelar_depan" VARCHAR(50),
    "gelar_belakang" VARCHAR(50),
    "nip" VARCHAR(30),
    "nuptk" VARCHAR(30),
    "nomor_telepon" VARCHAR(30),
    "foto_profil_url" TEXT,
    "preferensi_mata_pelajaran" VARCHAR(150),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "institutions" (
    "id" UUID NOT NULL,
    "npsn" VARCHAR(20) NOT NULL,
    "nama_resmi" VARCHAR(255) NOT NULL,
    "nama_singkat" VARCHAR(100) NOT NULL,
    "jenjang" VARCHAR(20) NOT NULL,
    "jenis_institusi" VARCHAR(20) NOT NULL,
    "kementerian_dinas" VARCHAR(255) NOT NULL,
    "alamat_lengkap" TEXT NOT NULL,
    "kelurahan_desa" VARCHAR(100),
    "kecamatan" VARCHAR(100),
    "kabupaten_kota" VARCHAR(100) NOT NULL,
    "provinsi" VARCHAR(100) NOT NULL,
    "kode_pos" VARCHAR(20),
    "telepon" VARCHAR(50),
    "email" VARCHAR(255),
    "website" VARCHAR(255),
    "logo_url" TEXT,
    "nama_kepala" VARCHAR(255),
    "nip_kepala" VARCHAR(30),
    "kota_tanda_tangan" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "institution_memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "role" "InstitutionRole" NOT NULL DEFAULT 'TEACHER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "institution_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "master_input" JSONB NOT NULL,
    "documents" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "institution_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "details" JSONB,
    "ip_address" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "institutions_npsn_key" ON "institutions"("npsn");

CREATE INDEX "institution_memberships_institution_id_idx" ON "institution_memberships"("institution_id");
CREATE INDEX "institution_memberships_user_id_idx" ON "institution_memberships"("user_id");
CREATE UNIQUE INDEX "institution_memberships_user_id_institution_id_key" ON "institution_memberships"("user_id", "institution_id");

CREATE INDEX "projects_institution_id_idx" ON "projects"("institution_id");
CREATE INDEX "projects_user_id_idx" ON "projects"("user_id");
CREATE INDEX "projects_user_id_institution_id_idx" ON "projects"("user_id", "institution_id");
CREATE INDEX "projects_created_at_idx" ON "projects"("created_at");

CREATE INDEX "audit_logs_institution_id_idx" ON "audit_logs"("institution_id");
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

ALTER TABLE "institution_memberships" ADD CONSTRAINT "institution_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "institution_memberships" ADD CONSTRAINT "institution_memberships_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_institution_id_fkey" FOREIGN KEY ("user_id", "institution_id") REFERENCES "institution_memberships"("user_id", "institution_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
