import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api, type AttributionSettings } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { DashboardPanel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import styles from "./CampaignPage.module.scss";

const INGEST_BASE = (import.meta.env.VITE_INGEST_URL ?? import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(
  /\/$/,
  "",
);

export function AppSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { token } = useAuth();
  const [companyId, setCompanyId] = useState("");
  const [settings, setSettings] = useState<AttributionSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token || !projectId) return;
    setLoading(true);
    try {
      const data = await api.getSettings(token, projectId);
      setSettings(data.settings);
      setCompanyId(data.companyId);
    } finally {
      setLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token || !projectId) return;
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await api.saveSettings(token, projectId, {
        iosAppId: String(form.get("iosAppId") ?? "").trim() || null,
        iosTeamId: String(form.get("iosTeamId") ?? "").trim() || null,
        androidPackage: String(form.get("androidPackage") ?? "").trim() || null,
        associatedDomain: String(form.get("associatedDomain") ?? "").trim() || null,
        partnerPostbackUrl: String(form.get("partnerPostbackUrl") ?? "").trim() || null,
        installAttributionWindowHours: Number(form.get("installWindowHours") ?? 24) || 24,
        viewThroughAttributionWindowHours: Number(form.get("viewThroughWindowHours") ?? 24) || 24,
        enableProbabilisticMatching: form.get("enableProbabilistic") === "on",
        androidSha256Certs: String(form.get("androidSha256Certs") ?? "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        skanIds: String(form.get("skanIds") ?? "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      toast.success("Settings saved");
      await load();
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (!projectId) return null;

  return (
    <div className={styles.root}>
      <DashboardPageHeader
        backHref={`/dashboard/${projectId}`}
        backLabel="Project"
        eyebrow="Configuration"
        title="App settings"
        description={
          <p>Configure Universal Links, App Links, SKAN IDs, and attribution windows for this project.</p>
        }
      />

      <DashboardPanel>
        {loading ? (
          <p>Loading…</p>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className={styles.form}>
            <h3 className={styles.sectionTitle}>iOS</h3>
            <div className={styles.formRow}>
              <Input
                name="iosAppId"
                label="Bundle ID (ios_app_id)"
                defaultValue={settings?.iosAppId ?? ""}
                mono
              />
              <Input name="iosTeamId" label="Team ID" defaultValue={settings?.iosTeamId ?? ""} mono />
            </div>
            <h3 className={styles.sectionTitle}>Android</h3>
            <Input
              name="androidPackage"
              label="Package name"
              defaultValue={settings?.androidPackage ?? ""}
              mono
            />
            <Textarea
              name="androidSha256Certs"
              label="SHA256 cert fingerprints (one per line)"
              rows={3}
              defaultValue={(settings?.androidSha256Certs ?? []).join("\n")}
              mono
            />
            <h3 className={styles.sectionTitle}>Deep linking</h3>
            <Input
              name="associatedDomain"
              label="Associated domain"
              defaultValue={settings?.associatedDomain ?? ""}
              placeholder="go.example.com"
              mono
            />
            {companyId ? (
              <p className={styles.codeNote}>
                Universal Links:{" "}
                <code>{INGEST_BASE}/.well-known/apple-app-site-association/{companyId}</code>
                <br />
                App Links: <code>{INGEST_BASE}/.well-known/assetlinks.json/{companyId}</code>
              </p>
            ) : null}
            <h3 className={styles.sectionTitle}>Attribution</h3>
            <Input
              name="installWindowHours"
              type="number"
              label="Install attribution window (hours)"
              min={1}
              defaultValue={settings?.installAttributionWindowHours ?? 24}
            />
            <Input
              name="viewThroughWindowHours"
              type="number"
              label="View-through (VTA) window (hours)"
              min={1}
              defaultValue={settings?.viewThroughAttributionWindowHours ?? 24}
            />
            <label className={styles.checkbox}>
              <input
                name="enableProbabilistic"
                type="checkbox"
                defaultChecked={settings?.enableProbabilisticMatching !== false}
              />
              Enable probabilistic IP matching
            </label>
            <Input
              name="partnerPostbackUrl"
              label="Partner postback URL template"
              defaultValue={settings?.partnerPostbackUrl ?? ""}
              placeholder="https://partner.com/postback?click_id={click_id}&campaign={campaign_id}"
            />
            <Textarea
              name="skanIds"
              label="SKAdNetwork IDs (one per line)"
              rows={3}
              defaultValue={(settings?.skanIds ?? []).join("\n")}
              mono
            />
            <Button type="submit" disabled={saving} size="sm" alignSelfStart>
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </form>
        )}
      </DashboardPanel>
    </div>
  );
}
