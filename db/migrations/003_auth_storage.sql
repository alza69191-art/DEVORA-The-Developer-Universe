-- Auth hardening, request throttling, Forgejo mapping, and object metadata.
ALTER TABLE devora.repositories
  ADD COLUMN IF NOT EXISTS forgejo_owner VARCHAR(100),
  ADD COLUMN IF NOT EXISTS forgejo_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS forgejo_html_url TEXT,
  ADD COLUMN IF NOT EXISTS clone_url TEXT,
  ADD COLUMN IF NOT EXISTS ssh_url TEXT;

CREATE TABLE IF NOT EXISTS devora.auth_rate_limits (
  key_hash CHAR(64) PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS devora.repository_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES devora.repositories(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES devora.users(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  file_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_devora_assets_repo ON devora.repository_assets(repository_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devora_repos_owner_created ON devora.repositories(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devora_email_tokens_expiry ON devora.email_tokens(expires_at) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_devora_sessions_token_expiry ON devora.sessions(token_hash, expires_at);
