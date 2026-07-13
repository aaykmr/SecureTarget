import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api, type TrackingLink } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { DashboardPanel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildTrackingLinkUrl, parseCampaignPresets } from "@/lib/tracking-link-presets";
import styles from "./CampaignPage.module.scss";
import linkStyles from "./LinksManager.module.scss";

const INGEST_BASE = (import.meta.env.VITE_INGEST_URL ?? import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(
  /\/$/,
  "",
);

export function LinksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { token } = useAuth();
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [iosUrl, setIosUrl] = useState("");
  const [androidUrl, setAndroidUrl] = useState("");
  const [webUrl, setWebUrl] = useState("");

  const load = useCallback(async () => {
    if (!token || !projectId) return;
    setLoading(true);
    try {
      const data = await api.listLinks(token, projectId);
      setLinks(data.links);
    } finally {
      setLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !projectId) return;
    setCreating(true);
    try {
      await api.createLink(token, projectId, {
        name,
        slug,
        iosUrl: iosUrl || undefined,
        androidUrl: androidUrl || undefined,
        webUrl: webUrl || undefined,
      });
      setName("");
      setSlug("");
      setIosUrl("");
      setAndroidUrl("");
      setWebUrl("");
      toast.success("Link created");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create link");
    } finally {
      setCreating(false);
    }
  };

  const onDelete = async (linkId: string) => {
    if (!token || !projectId) return;
    try {
      await api.deleteLink(token, projectId, linkId);
      toast.success("Link deleted");
      await load();
    } catch {
      toast.error("Failed to delete link");
    }
  };

  if (!projectId) return null;

  return (
    <div className={styles.root}>
      <DashboardPageHeader
        backHref={`/dashboard/${projectId}`}
        backLabel="Project"
        eyebrow="Campaigns"
        title="Campaign links"
        description={
          <p>
            OneLink-style URLs that record clicks before redirecting to App Store, Play Store, or your web landing
            page.
          </p>
        }
      />

      <DashboardPanel title="Create link" lead="Slug must be lowercase letters, numbers, and hyphens only.">
        <form onSubmit={(e) => void onCreate(e)} className={styles.form}>
          <div className={styles.formRow}>
            <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer launch" />
            <Input
              label="Slug"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="summer"
              pattern="[a-z0-9-]+"
              mono
            />
          </div>
          <div className={styles.formRow}>
            <Input label="iOS App Store URL" type="url" value={iosUrl} onChange={(e) => setIosUrl(e.target.value)} />
            <Input label="Android Play URL" type="url" value={androidUrl} onChange={(e) => setAndroidUrl(e.target.value)} />
          </div>
          <Input label="Web landing URL" type="url" value={webUrl} onChange={(e) => setWebUrl(e.target.value)} />
          <Button type="submit" disabled={creating} size="sm" alignSelfStart>
            {creating ? "Creating…" : "Create link"}
          </Button>
        </form>
      </DashboardPanel>

      {loading ? <p>Loading…</p> : null}

      <DashboardPanel title="Your links">
        {links.length === 0 ? (
          <p className={styles.emptyList}>No tracking links yet.</p>
        ) : (
          <ul className={styles.linkList}>
            {links.map((link) => {
              const baseUrl = `${INGEST_BASE}/v1/l/${link.slug}`;
              const presets = parseCampaignPresets(link.campaign_presets_json);
              return (
                <li key={link.id} className={styles.linkItem}>
                  <strong>{link.name}</strong>
                  <span className={styles.url}>{baseUrl}</span>
                  {presets.length > 0 ? (
                    <ul className={linkStyles.presetList}>
                      {presets.map((preset) => (
                        <li key={preset.id}>
                          <span>{preset.label}</span>
                          <code className={styles.url}>
                            {buildTrackingLinkUrl(INGEST_BASE, link.slug, preset)}
                          </code>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <Button type="button" size="sm" variant="secondary" onClick={() => void onDelete(link.id)}>
                    Delete
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardPanel>
    </div>
  );
}
