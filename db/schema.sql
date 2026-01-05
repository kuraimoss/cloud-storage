-- Cloud Storage (PostgreSQL) schema
-- Idempotent: safe to re-run.

CREATE SCHEMA IF NOT EXISTS cloud_storage;
SET search_path TO cloud_storage, public;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  email citext UNIQUE,
  password_hash text NOT NULL,
  storage_quota_bytes bigint NOT NULL DEFAULT 5368709120, -- 5 GiB
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'super_admin'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT folders_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT folders_unique_name_per_parent UNIQUE (user_id, parent_id, name)
);

CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES folders(id) ON DELETE SET NULL,
  original_name text NOT NULL,
  stored_name text NOT NULL UNIQUE,
  mime_type text,
  size_bytes bigint NOT NULL,
  sha256_hex text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT files_size_nonnegative CHECK (size_bytes >= 0),
  CONSTRAINT files_sha256_hex_format CHECK (sha256_hex IS NULL OR sha256_hex ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS files_user_created_idx ON files (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS files_user_original_name_idx ON files (user_id, original_name);

CREATE TABLE IF NOT EXISTS shared_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  short_code text,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  view_count bigint NOT NULL DEFAULT 0,
  download_count bigint NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT shared_files_expires_future CHECK (expires_at IS NULL OR expires_at > created_at)
);

ALTER TABLE IF EXISTS shared_files
  ADD COLUMN IF NOT EXISTS short_code text;
ALTER TABLE IF EXISTS shared_files
  ADD COLUMN IF NOT EXISTS view_count bigint NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS shared_files
  ADD COLUMN IF NOT EXISTS download_count bigint NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS shared_files
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz;

CREATE INDEX IF NOT EXISTS shared_files_file_id_idx ON shared_files (file_id);
CREATE INDEX IF NOT EXISTS shared_files_active_idx ON shared_files (is_active) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS shared_files_short_code_uq ON shared_files (short_code) WHERE short_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS activity_logs (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  file_id uuid REFERENCES files(id) ON DELETE SET NULL,
  action text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_user_created_idx ON activity_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_file_created_idx ON activity_logs (file_id, created_at DESC);

-- Short-lived public tokens (for private previews)
CREATE TABLE IF NOT EXISTS preview_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  purpose text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  max_uses int NOT NULL DEFAULT 3,
  used_count int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT preview_tokens_max_uses_check CHECK (max_uses >= 1 AND max_uses <= 50),
  CONSTRAINT preview_tokens_used_count_check CHECK (used_count >= 0)
);

CREATE INDEX IF NOT EXISTS preview_tokens_file_created_idx ON preview_tokens (file_id, created_at DESC);
CREATE INDEX IF NOT EXISTS preview_tokens_active_idx ON preview_tokens (expires_at) WHERE revoked_at IS NULL;

-- Optional: session table for connect-pg-simple (persistent sessions)
CREATE TABLE IF NOT EXISTS "session" (
  sid varchar NOT NULL COLLATE "default",
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'session'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE "session"
      ADD CONSTRAINT "session_pkey" PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" (expire);
