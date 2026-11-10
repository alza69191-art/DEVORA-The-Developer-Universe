-- DEVORA platform core: identity, membership, collaboration, and activity.
ALTER TABLE devora.users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS devora.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES devora.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_devora_sessions_user ON devora.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_devora_sessions_expiry ON devora.sessions(expires_at);

CREATE TABLE IF NOT EXISTS devora.email_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES devora.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  purpose VARCHAR(24) NOT NULL CHECK (purpose IN ('verify_email','reset_password','change_email')),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_devora_email_tokens_user ON devora.email_tokens(user_id, purpose);

CREATE TABLE IF NOT EXISTS devora.workspace_members (
  workspace_id UUID NOT NULL REFERENCES devora.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES devora.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
  invited_by UUID REFERENCES devora.users(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_devora_workspace_members_user ON devora.workspace_members(user_id);

CREATE TABLE IF NOT EXISTS devora.repository_collaborators (
  repository_id UUID NOT NULL REFERENCES devora.repositories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES devora.users(id) ON DELETE CASCADE,
  permission VARCHAR(20) NOT NULL DEFAULT 'read' CHECK (permission IN ('read','triage','write','maintain','admin')),
  added_by UUID REFERENCES devora.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (repository_id, user_id)
);

CREATE TABLE IF NOT EXISTS devora.repository_stars (
  repository_id UUID NOT NULL REFERENCES devora.repositories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES devora.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (repository_id, user_id)
);
CREATE TABLE IF NOT EXISTS devora.repository_watchers (
  repository_id UUID NOT NULL REFERENCES devora.repositories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES devora.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (repository_id, user_id)
);

CREATE TABLE IF NOT EXISTS devora.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES devora.repositories(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  due_on TIMESTAMPTZ,
  state VARCHAR(12) NOT NULL DEFAULT 'open' CHECK (state IN ('open','closed')),
  created_by UUID NOT NULL REFERENCES devora.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE devora.issues ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES devora.milestones(id) ON DELETE SET NULL;
ALTER TABLE devora.issues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE devora.issues ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS devora.issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES devora.issues(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES devora.users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_devora_issue_comments_issue ON devora.issue_comments(issue_id, created_at);

CREATE TABLE IF NOT EXISTS devora.labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES devora.repositories(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color CHAR(6) NOT NULL DEFAULT '6B7280',
  description VARCHAR(200),
  UNIQUE(repository_id, name)
);
CREATE TABLE IF NOT EXISTS devora.issue_labels (
  issue_id UUID NOT NULL REFERENCES devora.issues(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES devora.labels(id) ON DELETE CASCADE,
  PRIMARY KEY(issue_id, label_id)
);

ALTER TABLE devora.pull_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE devora.pull_requests ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ;
ALTER TABLE devora.pull_requests ADD COLUMN IF NOT EXISTS head_sha VARCHAR(64);
ALTER TABLE devora.pull_requests ADD COLUMN IF NOT EXISTS base_sha VARCHAR(64);

CREATE TABLE IF NOT EXISTS devora.pull_request_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pull_request_id UUID NOT NULL REFERENCES devora.pull_requests(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES devora.users(id),
  state VARCHAR(20) NOT NULL CHECK (state IN ('commented','approved','changes_requested')),
  body TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_devora_pr_reviews_pr ON devora.pull_request_reviews(pull_request_id, submitted_at);

CREATE TABLE IF NOT EXISTS devora.pull_request_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pull_request_id UUID NOT NULL REFERENCES devora.pull_requests(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES devora.users(id),
  body TEXT NOT NULL,
  file_path TEXT,
  line_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devora.releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES devora.repositories(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES devora.users(id),
  tag_name VARCHAR(120) NOT NULL,
  name VARCHAR(200),
  body TEXT,
  is_draft BOOLEAN NOT NULL DEFAULT FALSE,
  is_prerelease BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(repository_id, tag_name)
);

CREATE TABLE IF NOT EXISTS devora.discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES devora.repositories(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES devora.users(id),
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'general',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS devora.discussion_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES devora.discussions(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES devora.users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devora.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES devora.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES devora.users(id) ON DELETE SET NULL,
  type VARCHAR(60) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  resource_type VARCHAR(40),
  resource_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_devora_notifications_user ON devora.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devora_notifications_unread ON devora.notifications(user_id) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS devora.api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES devora.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  token_prefix VARCHAR(16) NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_devora_api_tokens_user ON devora.api_tokens(user_id);

CREATE TABLE IF NOT EXISTS devora.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES devora.repositories(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES devora.users(id),
  target_url TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  events TEXT[] NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devora.audit_events_v2 (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES devora.users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  ip_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_devora_audit_v2_created ON devora.audit_events_v2(created_at DESC);
