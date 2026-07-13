import crypto from "node:crypto";
import type { Database } from "better-sqlite3";
import type pg from "pg";
import type { DeviceDetails } from "../../../packages/contracts/src/device.js";
import { isPgConn, pgExecute, pgQuery, pgQueryOne } from "../db/ingestDb.js";

export interface BootstrapPersistInput {
  companyId: string;
  sessionId: string;
  device: DeviceDetails;
  occurredAt: string;
  ip?: string | null;
  userAgent?: string | null;
}

function fingerprintHash(companyId: string, device: DeviceDetails, ip?: string | null): string {
  const parts = [
    companyId,
    device.platform,
    device.advertisingId ?? "",
    device.vendorId ?? "",
    device.model ?? "",
    device.osVersion ?? "",
    device.userAgent ?? "",
    ip ?? "",
  ];
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}

function resolveAdvertisingIds(device: DeviceDetails): { idfa: string | null; gaid: string | null } {
  if (device.platform === "ios" && device.advertisingId) {
    return { idfa: device.advertisingId, gaid: null };
  }
  if (device.platform === "android" && device.advertisingId) {
    return { idfa: null, gaid: device.advertisingId };
  }
  return { idfa: null, gaid: null };
}

export async function findIdentityBySession(
  deviceDb: Database | pg.Pool,
  companyId: string,
  sessionId: string,
): Promise<{ identityId: string } | undefined> {
  if (isPgConn(deviceDb)) {
    return pgQueryOne<{ identityId: string }>(
      deviceDb,
      `SELECT identity_id AS "identityId" FROM identity_sessions WHERE session_id = $1 AND company_id = $2`,
      [sessionId, companyId],
    );
  }
  return deviceDb
    .prepare(`SELECT identity_id AS identityId FROM identity_sessions WHERE session_id = ? AND company_id = ?`)
    .get(sessionId, companyId) as { identityId: string } | undefined;
}

export async function findIdentityByAdvertisingId(
  deviceDb: Database | pg.Pool,
  companyId: string,
  idfa?: string | null,
  gaid?: string | null,
): Promise<{ identityId: string } | undefined> {
  if (isPgConn(deviceDb)) {
    if (idfa) {
      const row = await pgQueryOne<{ identityId: string }>(
        deviceDb,
        `SELECT id AS "identityId" FROM device_identities WHERE company_id = $1 AND idfa = $2 LIMIT 1`,
        [companyId, idfa],
      );
      if (row) return row;
    }
    if (gaid) {
      return pgQueryOne<{ identityId: string }>(
        deviceDb,
        `SELECT id AS "identityId" FROM device_identities WHERE company_id = $1 AND gaid = $2 LIMIT 1`,
        [companyId, gaid],
      );
    }
    return undefined;
  }
  if (idfa) {
    const row = deviceDb
      .prepare(`SELECT id AS identityId FROM device_identities WHERE company_id = ? AND idfa = ? LIMIT 1`)
      .get(companyId, idfa) as { identityId: string } | undefined;
    if (row) return row;
  }
  if (gaid) {
    return deviceDb
      .prepare(`SELECT id AS identityId FROM device_identities WHERE company_id = ? AND gaid = ? LIMIT 1`)
      .get(companyId, gaid) as { identityId: string } | undefined;
  }
  return undefined;
}

export async function persistBootstrapSnapshot(
  deviceDb: Database | pg.Pool,
  input: BootstrapPersistInput,
): Promise<string> {
  const { companyId, sessionId, device, occurredAt, ip, userAgent } = input;
  const now = new Date().toISOString();
  const { idfa, gaid } = resolveAdvertisingIds(device);
  const fpHash = fingerprintHash(companyId, device, ip);

  const existingSession = await findIdentityBySession(deviceDb, companyId, sessionId);
  let identityId = existingSession?.identityId;

  if (!identityId) {
    const byAd = await findIdentityByAdvertisingId(deviceDb, companyId, idfa, gaid);
    identityId = byAd?.identityId;
  }

  if (!identityId) {
    identityId = crypto.randomUUID();
    if (isPgConn(deviceDb)) {
      await pgExecute(
        deviceDb,
        `INSERT INTO device_identities
          (id, company_id, platform, idfa, gaid, vendor_id, fingerprint_hash, first_seen_at, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [identityId, companyId, device.platform, idfa, gaid, device.vendorId ?? null, fpHash, occurredAt, now],
      );
    } else {
      deviceDb
        .prepare(
          `INSERT INTO device_identities
            (id, company_id, platform, idfa, gaid, vendor_id, fingerprint_hash, first_seen_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(identityId, companyId, device.platform, idfa, gaid, device.vendorId ?? null, fpHash, occurredAt, now);
    }
  } else if (isPgConn(deviceDb)) {
    await pgExecute(
      deviceDb,
      `UPDATE device_identities SET
        last_seen_at = $1,
        idfa = COALESCE($2, idfa),
        gaid = COALESCE($3, gaid),
        vendor_id = COALESCE($4, vendor_id),
        fingerprint_hash = COALESCE($5, fingerprint_hash)
       WHERE id = $6 AND company_id = $7`,
      [now, idfa, gaid, device.vendorId ?? null, fpHash, identityId, companyId],
    );
  } else {
    deviceDb
      .prepare(
        `UPDATE device_identities SET
          last_seen_at = ?,
          idfa = COALESCE(?, idfa),
          gaid = COALESCE(?, gaid),
          vendor_id = COALESCE(?, vendor_id),
          fingerprint_hash = COALESCE(?, fingerprint_hash)
         WHERE id = ? AND company_id = ?`,
      )
      .run(now, idfa, gaid, device.vendorId ?? null, fpHash, identityId, companyId);
  }

  if (isPgConn(deviceDb)) {
    await pgExecute(
      deviceDb,
      `INSERT INTO identity_sessions (session_id, identity_id, company_id, linked_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id, company_id) DO UPDATE SET identity_id = EXCLUDED.identity_id, linked_at = EXCLUDED.linked_at`,
      [sessionId, identityId, companyId, now],
    );
    await pgExecute(
      deviceDb,
      `INSERT INTO device_snapshots
        (id, identity_id, company_id, session_id, snapshot_json, ip, user_agent, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        crypto.randomUUID(),
        identityId,
        companyId,
        sessionId,
        JSON.stringify(device),
        ip ?? null,
        userAgent ?? null,
        occurredAt,
      ],
    );
  } else {
    deviceDb
      .prepare(
        `INSERT OR REPLACE INTO identity_sessions (session_id, identity_id, company_id, linked_at) VALUES (?, ?, ?, ?)`,
      )
      .run(sessionId, identityId, companyId, now);
    deviceDb
      .prepare(
        `INSERT INTO device_snapshots
          (id, identity_id, company_id, session_id, snapshot_json, ip, user_agent, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        crypto.randomUUID(),
        identityId,
        companyId,
        sessionId,
        JSON.stringify(device),
        ip ?? null,
        userAgent ?? null,
        occurredAt,
      );
  }

  if (device.installReferrer || device.deepLinkUrl || device.utm) {
    await storeInstallSignal(deviceDb, {
      companyId,
      sessionId,
      identityId,
      signalType: "bootstrap",
      payload: {
        installReferrer: device.installReferrer,
        deepLinkUrl: device.deepLinkUrl,
        utm: device.utm,
      },
      receivedAt: occurredAt,
    });
  }

  return identityId;
}

export async function storeInstallSignal(
  deviceDb: Database | pg.Pool,
  input: {
    companyId: string;
    sessionId: string;
    identityId?: string | null;
    signalType: string;
    payload: Record<string, unknown>;
    receivedAt: string;
  },
): Promise<void> {
  const id = crypto.randomUUID();
  if (isPgConn(deviceDb)) {
    await pgExecute(
      deviceDb,
      `INSERT INTO install_signals (id, identity_id, company_id, session_id, signal_type, payload_json, received_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        input.identityId ?? null,
        input.companyId,
        input.sessionId,
        input.signalType,
        JSON.stringify(input.payload),
        input.receivedAt,
      ],
    );
    return;
  }
  deviceDb
    .prepare(
      `INSERT INTO install_signals (id, identity_id, company_id, session_id, signal_type, payload_json, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.identityId ?? null,
      input.companyId,
      input.sessionId,
      input.signalType,
      JSON.stringify(input.payload),
      input.receivedAt,
    );
}

export async function getIdentityForSession(
  deviceDb: Database | pg.Pool,
  companyId: string,
  sessionId: string,
): Promise<{ identityId: string; idfa: string | null; gaid: string | null; platform: string } | undefined> {
  if (isPgConn(deviceDb)) {
    return pgQueryOne(
      deviceDb,
      `SELECT di.id AS "identityId", di.idfa, di.gaid, di.platform
       FROM identity_sessions isess
       JOIN device_identities di ON di.id = isess.identity_id
       WHERE isess.session_id = $1 AND isess.company_id = $2`,
      [sessionId, companyId],
    );
  }
  return deviceDb
    .prepare(
      `SELECT di.id AS identityId, di.idfa, di.gaid, di.platform
       FROM identity_sessions isess
       JOIN device_identities di ON di.id = isess.identity_id
       WHERE isess.session_id = ? AND isess.company_id = ?`,
    )
    .get(sessionId, companyId) as
    | { identityId: string; idfa: string | null; gaid: string | null; platform: string }
    | undefined;
}

export async function getLatestSnapshot(
  deviceDb: Database | pg.Pool,
  companyId: string,
  sessionId: string,
): Promise<{ snapshotJson: string; ip: string | null; userAgent: string | null } | undefined> {
  if (isPgConn(deviceDb)) {
    return pgQueryOne(
      deviceDb,
      `SELECT snapshot_json AS "snapshotJson", ip, user_agent AS "userAgent"
       FROM device_snapshots
       WHERE company_id = $1 AND session_id = $2
       ORDER BY occurred_at DESC LIMIT 1`,
      [companyId, sessionId],
    );
  }
  return deviceDb
    .prepare(
      `SELECT snapshot_json AS snapshotJson, ip, user_agent AS userAgent
       FROM device_snapshots
       WHERE company_id = ? AND session_id = ?
       ORDER BY occurred_at DESC LIMIT 1`,
    )
    .get(companyId, sessionId) as { snapshotJson: string; ip: string | null; userAgent: string | null } | undefined;
}
