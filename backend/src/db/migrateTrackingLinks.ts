import type pg from "pg";
import type Database from "better-sqlite3";

/**
 * Idempotent migrations for typed tracking links, impressions, and VTA settings.
 */
export async function migrateTrackingLinksSchema(db: pg.Pool): Promise<void> {
  await db.query(`ALTER TABLE tracking_links ADD COLUMN IF NOT EXISTS link_type TEXT`);
  await db.query(`ALTER TABLE tracking_links ADD COLUMN IF NOT EXISTS config_json JSONB`);
  await db.query(`
    UPDATE tracking_links SET link_type = CASE
      WHEN link_type IS NOT NULL THEN link_type
      WHEN COALESCE(destination_type, '') = 'multi'
        OR (ios_url IS NOT NULL AND android_url IS NOT NULL) THEN 'one_link'
      WHEN web_url IS NOT NULL AND ios_url IS NULL AND android_url IS NULL THEN 'hyperlink'
      ELSE 'one_link'
    END
    WHERE link_type IS NULL
  `);
  await db.query(`ALTER TABLE tracking_links ALTER COLUMN link_type SET DEFAULT 'one_link'`);
  await db.query(`UPDATE tracking_links SET link_type = 'one_link' WHERE link_type IS NULL`);
  await db.query(`ALTER TABLE tracking_links ALTER COLUMN link_type SET NOT NULL`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_tracking_links_type ON tracking_links(company_id, link_type)`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS link_impressions (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      link_id TEXT,
      impression_id TEXT NOT NULL UNIQUE,
      media_source TEXT,
      campaign_id TEXT,
      adgroup_id TEXT,
      creative_id TEXT,
      channel TEXT,
      ip TEXT,
      user_agent TEXT,
      viewed_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      matched_at TIMESTAMPTZ,
      metadata_json TEXT
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_link_impressions_company ON link_impressions(company_id, viewed_at DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_link_impressions_link ON link_impressions(link_id, viewed_at DESC)`);

  await db.query(`ALTER TABLE attribution_events ADD COLUMN IF NOT EXISTS attribution_path TEXT`);
  await db.query(`
    UPDATE attribution_events SET attribution_path = CASE
      WHEN attribution_path IS NOT NULL THEN attribution_path
      WHEN COALESCE(is_organic, false) = true THEN 'organic'
      WHEN match_rule = 'vta_impression' THEN 'vta'
      ELSE 'cta'
    END
    WHERE attribution_path IS NULL
  `);

  await db.query(
    `ALTER TABLE project_attribution_settings ADD COLUMN IF NOT EXISTS view_through_attribution_window_hours INTEGER NOT NULL DEFAULT 24`,
  );
}

export function migrateTrackingLinksSqlite(db: Database.Database): void {
  const linkCols = db.prepare(`PRAGMA table_info(tracking_links)`).all() as { name: string }[];
  const linkNames = new Set(linkCols.map((c) => c.name));
  if (!linkNames.has("link_type")) {
    db.exec(`ALTER TABLE tracking_links ADD COLUMN link_type TEXT`);
  }
  if (!linkNames.has("config_json")) {
    db.exec(`ALTER TABLE tracking_links ADD COLUMN config_json TEXT`);
  }
  db.exec(`
    UPDATE tracking_links SET link_type = CASE
      WHEN link_type IS NOT NULL AND link_type != '' THEN link_type
      WHEN COALESCE(destination_type, '') = 'multi'
        OR (ios_url IS NOT NULL AND android_url IS NOT NULL) THEN 'one_link'
      WHEN web_url IS NOT NULL AND ios_url IS NULL AND android_url IS NULL THEN 'hyperlink'
      ELSE 'one_link'
    END
    WHERE link_type IS NULL OR link_type = ''
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tracking_links_type ON tracking_links(company_id, link_type)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS link_impressions (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      link_id TEXT,
      impression_id TEXT NOT NULL UNIQUE,
      media_source TEXT,
      campaign_id TEXT,
      adgroup_id TEXT,
      creative_id TEXT,
      channel TEXT,
      ip TEXT,
      user_agent TEXT,
      viewed_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      matched_at TEXT,
      metadata_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_link_impressions_company ON link_impressions(company_id, viewed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_link_impressions_link ON link_impressions(link_id, viewed_at DESC);
  `);

  const attrCols = db.prepare(`PRAGMA table_info(attribution_events)`).all() as { name: string }[];
  if (!attrCols.some((c) => c.name === "attribution_path")) {
    db.exec(`ALTER TABLE attribution_events ADD COLUMN attribution_path TEXT`);
  }
  db.exec(`
    UPDATE attribution_events SET attribution_path = CASE
      WHEN attribution_path IS NOT NULL AND attribution_path != '' THEN attribution_path
      WHEN COALESCE(is_organic, 0) = 1 THEN 'organic'
      WHEN match_rule = 'vta_impression' THEN 'vta'
      ELSE 'cta'
    END
    WHERE attribution_path IS NULL OR attribution_path = ''
  `);

  const settingsCols = db.prepare(`PRAGMA table_info(project_attribution_settings)`).all() as { name: string }[];
  if (!settingsCols.some((c) => c.name === "view_through_attribution_window_hours")) {
    db.exec(
      `ALTER TABLE project_attribution_settings ADD COLUMN view_through_attribution_window_hours INTEGER NOT NULL DEFAULT 24`,
    );
  }
}
