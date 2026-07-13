-- Postgres schema for SecureTarget (dashboard + ingest + device matching)
-- Applied automatically on backend startup when DATABASE_URL is set.

-- Dashboard
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_project ON api_keys(project_id);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  merchant_subscription_id TEXT NOT NULL UNIQUE,
  cf_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'INITIALIZED',
  customer_email TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ingest (customer attribution DB)
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
  cost_value DOUBLE PRECISION,
  cost_currency TEXT,
  landing_url TEXT,
  referrer TEXT,
  clicked_at TIMESTAMPTZ NOT NULL,
  metadata_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS login_tokens (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_salt TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS attribution_events (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  click_event_id TEXT NOT NULL REFERENCES click_events(id),
  conversion_event_id TEXT NOT NULL,
  attributed_at TIMESTAMPTZ NOT NULL,
  attribution_window_hours INTEGER NOT NULL,
  reengagement_window_hours INTEGER,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  match_rule TEXT,
  is_organic BOOLEAN
);

CREATE TABLE IF NOT EXISTS sdk_events (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  token_hash TEXT,
  payload_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processed_events (
  event_id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_tokens_company_hash ON login_tokens(company_id, token_hash);
CREATE INDEX IF NOT EXISTS idx_click_events_company_clicked ON click_events(company_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_click_events_company_token ON click_events(company_id, token_hash, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_attribution_company_hash ON attribution_events(company_id, token_hash);
CREATE INDEX IF NOT EXISTS idx_sdk_events_company_created ON sdk_events(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sdk_events_company_token ON sdk_events(company_id, token_hash);

CREATE TABLE IF NOT EXISTS client_sessions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, slug)
);

CREATE TABLE IF NOT EXISTS project_attribution_settings (
  company_id TEXT PRIMARY KEY,
  install_attribution_window_hours INTEGER NOT NULL DEFAULT 24,
  conversion_attribution_window_hours INTEGER NOT NULL DEFAULT 168,
  reengagement_window_hours INTEGER NOT NULL DEFAULT 168,
  enable_probabilistic_matching BOOLEAN NOT NULL DEFAULT TRUE,
  probabilistic_min_confidence DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  ios_app_id TEXT,
  android_package TEXT,
  ios_team_id TEXT,
  android_sha256_certs_json TEXT,
  associated_domain TEXT,
  skan_ids_json TEXT,
  partner_postback_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Device matching DB (same Postgres instance)
CREATE TABLE IF NOT EXISTS device_identities (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  idfa TEXT,
  gaid TEXT,
  vendor_id TEXT,
  fingerprint_hash TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS device_snapshots (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES device_identities(id),
  company_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS identity_sessions (
  session_id TEXT NOT NULL,
  identity_id TEXT NOT NULL REFERENCES device_identities(id),
  company_id TEXT NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, company_id)
);

CREATE TABLE IF NOT EXISTS install_signals (
  id TEXT PRIMARY KEY,
  identity_id TEXT REFERENCES device_identities(id),
  company_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_clicks (
  click_id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  link_id TEXT,
  media_source TEXT,
  campaign_id TEXT,
  adgroup_id TEXT,
  creative_id TEXT,
  channel TEXT,
  deep_link_value TEXT,
  ip TEXT,
  user_agent TEXT,
  platform_hint TEXT,
  clicked_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  matched_identity_id TEXT,
  matched_at TIMESTAMPTZ,
  gaid TEXT,
  idfa TEXT,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS click_device_signals (
  id TEXT PRIMARY KEY,
  click_id TEXT NOT NULL REFERENCES pending_clicks(click_id),
  company_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  signal_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_audit (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  install_event_id TEXT NOT NULL,
  session_id TEXT,
  identity_id TEXT,
  click_id TEXT,
  rule_name TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  inputs_json TEXT NOT NULL,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skan_postbacks (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  campaign_id TEXT,
  media_source TEXT,
  conversion_value INTEGER,
  postback_sequence INTEGER,
  coarse_value INTEGER,
  source_app_id TEXT,
  payload_json TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_postbacks (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL,
  partner_name TEXT NOT NULL,
  url TEXT NOT NULL,
  status_code INTEGER,
  response_body TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_costs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  media_source TEXT,
  campaign_id TEXT,
  cost_date TEXT NOT NULL,
  cost_value DOUBLE PRECISION NOT NULL,
  cost_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fraud_flags (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  flag_type TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_identities_company ON device_identities(company_id);
CREATE INDEX IF NOT EXISTS idx_device_identities_gaid ON device_identities(company_id, gaid);
CREATE INDEX IF NOT EXISTS idx_device_identities_idfa ON device_identities(company_id, idfa);
CREATE INDEX IF NOT EXISTS idx_device_snapshots_session ON device_snapshots(company_id, session_id);
CREATE INDEX IF NOT EXISTS idx_identity_sessions_identity ON identity_sessions(identity_id);
CREATE INDEX IF NOT EXISTS idx_pending_clicks_company ON pending_clicks(company_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_clicks_unmatched ON pending_clicks(company_id, matched_at, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_install_signals_session ON install_signals(company_id, session_id);
CREATE INDEX IF NOT EXISTS idx_match_audit_company ON match_audit(company_id, matched_at DESC);
CREATE INDEX IF NOT EXISTS idx_skan_postbacks_company ON skan_postbacks(company_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_costs_company ON campaign_costs(company_id, cost_date DESC);
