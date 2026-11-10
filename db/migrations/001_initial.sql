CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS devora;

CREATE TABLE IF NOT EXISTS devora.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(39) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash TEXT,
  avatar_url TEXT,
  bio VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devora.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES devora.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devora.repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES devora.workspaces(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES devora.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description VARCHAR(500),
  visibility VARCHAR(10) NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private','internal')),
  default_branch VARCHAR(100) NOT NULL DEFAULT 'main',
  forgejo_repo_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, slug)
);

CREATE TABLE IF NOT EXISTS devora.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES devora.repositories(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES devora.users(id),
  number INTEGER NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  state VARCHAR(12) NOT NULL DEFAULT 'open' CHECK (state IN ('open','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(repository_id, number)
);

CREATE TABLE IF NOT EXISTS devora.pull_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES devora.repositories(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES devora.users(id),
  number INTEGER NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  source_branch VARCHAR(255) NOT NULL,
  target_branch VARCHAR(255) NOT NULL DEFAULT 'main',
  state VARCHAR(12) NOT NULL DEFAULT 'open' CHECK (state IN ('open','closed','merged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(repository_id, number)
);

CREATE TABLE IF NOT EXISTS devora.audit_events (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES devora.users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devora_repositories_workspace ON devora.repositories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_devora_issues_repo_state ON devora.issues(repository_id, state);
CREATE INDEX IF NOT EXISTS idx_devora_pr_repo_state ON devora.pull_requests(repository_id, state);
CREATE INDEX IF NOT EXISTS idx_devora_audit_created ON devora.audit_events(created_at DESC);
