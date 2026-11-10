ALTER TABLE devora.repository_assets
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_devora_assets_uploaded
  ON devora.repository_assets(repository_id, created_at DESC)
  WHERE uploaded_at IS NOT NULL;
