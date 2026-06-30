"use client";

import { useActionState } from "react";
import { saveAppSettingsAction } from "@/app/dashboard/campaign-actions";
import styles from "../../campaigns/page.module.scss";

export function AppSettingsForm({
  projectId,
  settings,
  ingestBaseUrl,
  companyId,
}: {
  projectId: string;
  companyId: string;
  ingestBaseUrl: string;
  settings: {
    ios_app_id: string | null;
    android_package: string | null;
    ios_team_id: string | null;
    associated_domain: string | null;
    partner_postback_url: string | null;
    android_sha256_certs_json: string | null;
    skan_ids_json: string | null;
    install_attribution_window_hours: number;
    enable_probabilistic_matching: number;
  } | null;
}) {
  const [state, formAction, pending] = useActionState(saveAppSettingsAction, undefined);
  const certs = settings?.android_sha256_certs_json
    ? (JSON.parse(settings.android_sha256_certs_json) as string[]).join("\n")
    : "";
  const skanIds = settings?.skan_ids_json ? (JSON.parse(settings.skan_ids_json) as string[]).join("\n") : "";

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="projectId" value={projectId} />
      <h2 className={styles.sectionTitle}>iOS</h2>
      <div className={styles.formRow}>
        <label>
          Bundle ID (ios_app_id)
          <input name="iosAppId" defaultValue={settings?.ios_app_id ?? ""} />
        </label>
        <label>
          Team ID
          <input name="iosTeamId" defaultValue={settings?.ios_team_id ?? ""} />
        </label>
      </div>
      <h2 className={styles.sectionTitle}>Android</h2>
      <label>
        Package name
        <input name="androidPackage" defaultValue={settings?.android_package ?? ""} />
      </label>
      <label>
        SHA256 cert fingerprints (one per line)
        <textarea name="androidSha256Certs" rows={3} defaultValue={certs} />
      </label>
      <h2 className={styles.sectionTitle}>Deep linking</h2>
      <label>
        Associated domain
        <input name="associatedDomain" defaultValue={settings?.associated_domain ?? ""} placeholder="go.example.com" />
      </label>
      <p className={styles.lead}>
        Universal Links:{" "}
        <code>
          {ingestBaseUrl}/.well-known/apple-app-site-association/{companyId}
        </code>
        <br />
        App Links:{" "}
        <code>
          {ingestBaseUrl}/.well-known/assetlinks.json/{companyId}
        </code>
      </p>
      <h2 className={styles.sectionTitle}>Attribution</h2>
      <label>
        Install attribution window (hours)
        <input
          name="installWindowHours"
          type="number"
          min={1}
          defaultValue={settings?.install_attribution_window_hours ?? 24}
        />
      </label>
      <label className={styles.checkbox}>
        <input
          name="enableProbabilistic"
          type="checkbox"
          defaultChecked={settings?.enable_probabilistic_matching !== 0}
        />
        Enable probabilistic IP matching
      </label>
      <label>
        Partner postback URL template
        <input
          name="partnerPostbackUrl"
          defaultValue={settings?.partner_postback_url ?? ""}
          placeholder="https://partner.com/postback?click_id={click_id}&campaign={campaign_id}"
        />
      </label>
      <label>
        SKAdNetwork IDs (one per line)
        <textarea name="skanIds" rows={3} defaultValue={skanIds} />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </button>
      {state?.ok === false ? <p className={styles.error}>{state.error}</p> : null}
      {state?.ok ? <p className={styles.success}>Settings saved.</p> : null}
    </form>
  );
}
