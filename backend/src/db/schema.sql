CREATE TABLE IF NOT EXISTS click_events (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  token_hash TEXT,
  event_source_partner TEXT,
  media_source TEXT,
  campaign_id TEXT,
  adgroup_id TEXT,
  creative_id TEXT,
  channel TEXT,
  cost_model TEXT,
  cost_value REAL,
  cost_currency TEXT,
  landing_url TEXT,
  referrer TEXT,
  clicked_at TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_tokens (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_salt TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attribution_events (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  click_event_id TEXT NOT NULL,
  conversion_event_id TEXT NOT NULL,
  attributed_at TEXT NOT NULL,
  attribution_window_hours INTEGER NOT NULL,
  reengagement_window_hours INTEGER,
  confidence REAL NOT NULL DEFAULT 1.0,
  match_rule TEXT,
  is_organic INTEGER,
  FOREIGN KEY(click_event_id) REFERENCES click_events(id)
);

CREATE TABLE IF NOT EXISTS sdk_events (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  token_hash TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS processed_events (
  event_id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_tokens_company_hash ON login_tokens(company_id, token_hash);
CREATE INDEX IF NOT EXISTS idx_click_events_company_clicked ON click_events(company_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_click_events_company_token ON click_events(company_id, token_hash, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_attribution_company_hash ON attribution_events(company_id, token_hash);

CREATE INDEX IF NOT EXISTS idx_sdk_events_company_created ON sdk_events(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sdk_events_company_token ON sdk_events(company_id, token_hash);

-- Dashboard users, projects (company_id), API keys (hashed)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS organization_members (
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, user_id),
  FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  invited_by_user_id TEXT,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY(invited_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_invites_org ON invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT,
  name TEXT NOT NULL,
  company_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_project ON api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);

-- Cashfree billing (one row per dashboard user). When CASHFREE_* env is set, API keys + ingest require ACTIVE/BANK_APPROVAL_PENDING.
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  user_id TEXT PRIMARY KEY,
  merchant_subscription_id TEXT NOT NULL,
  cf_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'INITIALIZED',
  customer_email TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_merchant_subscription ON billing_subscriptions(merchant_subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status ON billing_subscriptions(status);

-- Client session: opaque id only (no device/IP persisted). Later requests use x-session-id only.
CREATE TABLE IF NOT EXISTS client_sessions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_client_sessions_company ON client_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_client_sessions_last_seen ON client_sessions(company_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS tracking_links (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  destination_type TEXT NOT NULL DEFAULT 'web',
  ios_url TEXT,
  android_url TEXT,
  web_url TEXT,
      default_params_json TEXT,
      campaign_presets_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_links_slug ON tracking_links(company_id, slug);

CREATE TABLE IF NOT EXISTS project_attribution_settings (
  company_id TEXT PRIMARY KEY,
  install_attribution_window_hours INTEGER NOT NULL DEFAULT 24,
  conversion_attribution_window_hours INTEGER NOT NULL DEFAULT 168,
  reengagement_window_hours INTEGER NOT NULL DEFAULT 168,
  enable_probabilistic_matching INTEGER NOT NULL DEFAULT 1,
  probabilistic_min_confidence REAL NOT NULL DEFAULT 0.7,
  ios_app_id TEXT,
  android_package TEXT,
  ios_team_id TEXT,
  android_sha256_certs_json TEXT,
  associated_domain TEXT,
  skan_ids_json TEXT,
  partner_postback_url TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
