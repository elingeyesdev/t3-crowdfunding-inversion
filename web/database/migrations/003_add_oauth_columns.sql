-- Migration: 003_add_oauth_columns
-- Adds Google OAuth support to the users table.
-- Run this before enabling Google OAuth login in production.

-- 1. Allow NULL password_hash for OAuth-only users
ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

-- 2. Add OAuth provider columns
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS oauth_provider     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS oauth_provider_id  VARCHAR(255);

-- 3. Unique index: one account per provider+id
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth
  ON users(oauth_provider, oauth_provider_id)
  WHERE oauth_provider IS NOT NULL AND oauth_provider_id IS NOT NULL;
