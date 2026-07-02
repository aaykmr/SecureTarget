"use client";

import { useActionState } from "react";
import { saveAppSettingsAction } from "@/app/dashboard/campaign-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
      <h3 className={styles.sectionTitle}>iOS</h3>
      <div className={styles.formRow}>
        <Input name="iosAppId" label="Bundle ID (ios_app_id)" defaultValue={settings?.ios_app_id ?? ""} mono />
        <Input name="iosTeamId" label="Team ID" defaultValue={settings?.ios_team_id ?? ""} mono />
      </div>
      <h3 className={styles.sectionTitle}>Android</h3>
      <Input name="androidPackage" label="Package name" defaultValue={settings?.android_package ?? ""} mono />
      <Textarea
        name="androidSha256Certs"
        label="SHA256 cert fingerprints (one per line)"
        rows={3}
        defaultValue={certs}
        mono
      />
      <h3 className={styles.sectionTitle}>Deep linking</h3>
      <Input
        name="associatedDomain"
        label="Associated domain"
        defaultValue={settings?.associated_domain ?? ""}
        placeholder="go.example.com"
        mono
      />
      <p className={styles.codeNote}>
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
      <h3 className={styles.sectionTitle}>Attribution</h3>
      <Input
        name="installWindowHours"
        type="number"
        label="Install attribution window (hours)"
        min={1}
        defaultValue={settings?.install_attribution_window_hours ?? 24}
      />
      <label className={styles.checkbox}>
        <input
          name="enableProbabilistic"
          type="checkbox"
          defaultChecked={settings?.enable_probabilistic_matching !== 0}
        />
        Enable probabilistic IP matching
      </label>
      <Input
        name="partnerPostbackUrl"
        label="Partner postback URL template"
        defaultValue={settings?.partner_postback_url ?? ""}
        placeholder="https://partner.com/postback?click_id={click_id}&campaign={campaign_id}"
      />
      <Textarea name="skanIds" label="SKAdNetwork IDs (one per line)" rows={3} defaultValue={skanIds} mono />
      <Button type="submit" disabled={pending} size="sm" alignSelfStart>
        {pending ? "Saving…" : "Save settings"}
      </Button>
      {state?.ok === false ? <p className={styles.error}>{state.error}</p> : null}
      {state?.ok ? <p className={styles.success}>Settings saved.</p> : null}
    </form>
  );
}
