CREATE TABLE IF NOT EXISTS device_identities (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  idfa TEXT,
  gaid TEXT,
  vendor_id TEXT,
  fingerprint_hash TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_snapshots (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(identity_id) REFERENCES device_identities(id)
);

CREATE TABLE IF NOT EXISTS identity_sessions (
  session_id TEXT NOT NULL,
  identity_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, company_id),
  FOREIGN KEY(identity_id) REFERENCES device_identities(id)
);

CREATE TABLE IF NOT EXISTS install_signals (
  id TEXT PRIMARY KEY,
  identity_id TEXT,
  company_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  received_at TEXT NOT NULL,
  FOREIGN KEY(identity_id) REFERENCES device_identities(id)
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
  clicked_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  matched_identity_id TEXT,
  matched_at TEXT,
  gaid TEXT,
  idfa TEXT,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS click_device_signals (
  id TEXT PRIMARY KEY,
  click_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  signal_value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(click_id) REFERENCES pending_clicks(click_id)
);

CREATE TABLE IF NOT EXISTS match_audit (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  install_event_id TEXT NOT NULL,
  session_id TEXT,
  identity_id TEXT,
  click_id TEXT,
  rule_name TEXT NOT NULL,
  confidence REAL NOT NULL,
  inputs_json TEXT NOT NULL,
  matched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaign_costs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  media_source TEXT,
  campaign_id TEXT,
  cost_date TEXT NOT NULL,
  cost_value REAL NOT NULL,
  cost_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fraud_flags (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  flag_type TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
