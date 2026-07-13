import clsx from "clsx";
import { useMemo, useState } from "react";
import type { ApiKey } from "@/api/client";
import { RevokeKeyForm } from "./revoke-key-form";
import styles from "./api-key-list.module.scss";

function formatKeyTimestamp(iso: string): string {
  const date = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function KeyRow({
  keyRow,
  projectId,
  showRevoke,
  subdued,
  onRevoked,
}: {
  keyRow: ApiKey;
  projectId: string;
  showRevoke?: boolean;
  subdued?: boolean;
  onRevoked?: () => void;
}) {
  const revoked = Boolean(keyRow.revoked_at);
  return (
    <li className={clsx(styles.keyRow, subdued && styles.keyRowSubdued)}>
      <div className={styles.keyMeta}>
        <span className={clsx(styles.keyPrefix, revoked ? styles.keyPrefixRevoked : styles.keyPrefixActive)}>
          {keyRow.key_prefix}…
        </span>
        <span className={clsx(styles.keySub, revoked ? styles.keySubRevoked : styles.keySubActive)}>
          {revoked ? `Revoked ${formatKeyTimestamp(keyRow.revoked_at!)}` : `Created ${formatKeyTimestamp(keyRow.created_at)}`}
        </span>
      </div>
      {showRevoke && !revoked ? (
        <RevokeKeyForm projectId={projectId} keyId={keyRow.id} onRevoked={onRevoked} />
      ) : null}
    </li>
  );
}

export function ApiKeyList({
  keys,
  projectId,
  onRevoked,
}: {
  keys: ApiKey[];
  projectId: string;
  onRevoked?: () => void;
}) {
  const { activeKey, legacyActiveKeys, revokedKeys } = useMemo(() => {
    const active = keys.filter((k) => !k.revoked_at).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const revoked = keys.filter((k) => k.revoked_at);
    return {
      activeKey: active[0] ?? null,
      legacyActiveKeys: active.slice(1),
      revokedKeys: revoked,
    };
  }, [keys]);

  const [revokedOpen, setRevokedOpen] = useState(false);
  const [legacyOpen, setLegacyOpen] = useState(false);

  if (keys.length === 0) {
    return <p className={styles.emptyKeys}>No keys yet.</p>;
  }

  return (
    <div className={styles.root}>
      <p className={styles.prefixHint}>Only the prefix is stored — generate a new key to rotate.</p>
      {activeKey ? (
        <ul className={styles.keyList}>
          <KeyRow keyRow={activeKey} projectId={projectId} showRevoke onRevoked={onRevoked} />
        </ul>
      ) : (
        <p className={styles.emptyKeys}>No active key. Generate one to send events from the SDK.</p>
      )}

      {legacyActiveKeys.length > 0 ? (
        <details className={styles.rollup} open={legacyOpen} onToggle={(e) => setLegacyOpen(e.currentTarget.open)}>
          <summary className={styles.rollupSummary}>
            Other active keys ({legacyActiveKeys.length})
            <span className={styles.rollupHint}>Rotate to replace with a single key</span>
          </summary>
          <ul className={styles.keyList}>
            {legacyActiveKeys.map((k) => (
              <KeyRow key={k.id} keyRow={k} projectId={projectId} showRevoke subdued onRevoked={onRevoked} />
            ))}
          </ul>
        </details>
      ) : null}

      {revokedKeys.length > 0 ? (
        <details className={styles.rollup} open={revokedOpen} onToggle={(e) => setRevokedOpen(e.currentTarget.open)}>
          <summary className={styles.rollupSummary}>Revoked keys ({revokedKeys.length})</summary>
          <ul className={styles.keyList}>
            {revokedKeys.map((k) => (
              <KeyRow key={k.id} keyRow={k} projectId={projectId} subdued />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
