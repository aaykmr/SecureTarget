import { FormEvent, useCallback, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api, type LinkType, type TrackingLink } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { DashboardPanel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LINK_TYPE_NAV, linkTypeFromSegment } from "@/lib/link-types";
import { buildTrackingLinkUrl, parseCampaignPresets } from "@/lib/tracking-link-presets";
import styles from "./CampaignPage.module.scss";
import linkStyles from "./LinksManager.module.scss";

const INGEST_BASE = (import.meta.env.VITE_INGEST_URL ?? import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(
  /\/$/,
  "",
);

type Fields = {
  showIos?: boolean;
  showAndroid?: boolean;
  showWeb?: boolean;
  showDestination?: boolean;
  showDeepLink?: boolean;
  showReferrer?: boolean;
  showViewWindow?: boolean;
  showCampaignDefaults?: boolean;
  showPixel?: boolean;
};

const TYPE_FIELDS: Record<LinkType, Fields> = {
  cta: { showIos: true, showAndroid: true, showWeb: true, showCampaignDefaults: true },
  vta: { showDestination: true, showCampaignDefaults: true, showViewWindow: true, showPixel: true },
  one_link: { showIos: true, showAndroid: true, showWeb: true },
  hyperlink: { showWeb: true },
  deeplink: { showIos: true, showAndroid: true, showDeepLink: true },
  short_link: { showDestination: true },
  ctv: { showDestination: true, showCampaignDefaults: true },
  referral: { showDestination: true, showWeb: true, showReferrer: true },
};

export function TypedLinkTypePage() {
  const { projectId, linkTypeSegment } = useParams<{ projectId: string; linkTypeSegment: string }>();
  const linkType = linkTypeFromSegment(linkTypeSegment);
  const meta = LINK_TYPE_NAV.find((t) => t.type === linkType);
  const fields = linkType ? TYPE_FIELDS[linkType] : null;
  const { token } = useAuth();
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [iosUrl, setIosUrl] = useState("");
  const [androidUrl, setAndroidUrl] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [deepLinkValue, setDeepLinkValue] = useState("");
  const [referrerCode, setReferrerCode] = useState("");
  const [mediaSource, setMediaSource] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [viewWindow, setViewWindow] = useState("24");

  const load = useCallback(async () => {
    if (!token || !projectId || !linkType) return;
    setLoading(true);
    try {
      const data = await api.listLinks(token, projectId, linkType);
      setLinks(data.links);
    } finally {
      setLoading(false);
    }
  }, [projectId, token, linkType]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!projectId) return null;
  if (!linkType || !meta || !fields) {
    return <Navigate to={`/dashboard/${projectId}/links/one-link`} replace />;
  }

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setCreating(true);
    try {
      await api.createLink(token, projectId, {
        name,
        slug,
        linkType,
        iosUrl: fields.showIos ? iosUrl || undefined : undefined,
        androidUrl: fields.showAndroid ? androidUrl || undefined : undefined,
        webUrl: fields.showWeb ? webUrl || undefined : undefined,
        destinationUrl: fields.showDestination ? destinationUrl || undefined : undefined,
        defaultDeepLinkValue: fields.showDeepLink ? deepLinkValue || undefined : undefined,
        referrerCode: fields.showReferrer ? referrerCode || undefined : undefined,
        mediaSource: fields.showCampaignDefaults ? mediaSource || undefined : undefined,
        campaignId: fields.showCampaignDefaults ? campaignId || undefined : undefined,
        viewThroughWindowHours: fields.showViewWindow ? Number(viewWindow) || 24 : undefined,
      });
      setName("");
      setSlug("");
      setIosUrl("");
      setAndroidUrl("");
      setWebUrl("");
      setDestinationUrl("");
      setDeepLinkValue("");
      setReferrerCode("");
      setMediaSource("");
      setCampaignId("");
      toast.success(`${meta.label} link created`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create link");
    } finally {
      setCreating(false);
    }
  };

  const onDelete = async (linkId: string) => {
    if (!token) return;
    try {
      await api.deleteLink(token, projectId, linkId);
      toast.success("Link deleted");
      await load();
    } catch {
      toast.error("Failed to delete link");
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <>
      <DashboardPanel title={`Create ${meta.label}`} lead={meta.description}>
        <form onSubmit={(e) => void onCreate(e)} className={styles.form}>
          <div className={styles.formRow}>
            <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder={`${meta.label} campaign`} />
            <Input
              label="Slug"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="summer-launch"
              pattern="[a-z0-9-]+"
              mono
            />
          </div>
          {fields.showIos || fields.showAndroid ? (
            <div className={styles.formRow}>
              {fields.showIos ? (
                <Input label="iOS App Store URL" type="url" value={iosUrl} onChange={(e) => setIosUrl(e.target.value)} />
              ) : null}
              {fields.showAndroid ? (
                <Input
                  label="Android Play URL"
                  type="url"
                  value={androidUrl}
                  onChange={(e) => setAndroidUrl(e.target.value)}
                />
              ) : null}
            </div>
          ) : null}
          {fields.showWeb ? (
            <Input
              label="Web landing URL"
              type="url"
              required={linkType === "hyperlink"}
              value={webUrl}
              onChange={(e) => setWebUrl(e.target.value)}
            />
          ) : null}
          {fields.showDestination ? (
            <Input
              label="Destination URL"
              type="url"
              required={linkType === "short_link"}
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              placeholder="https://example.com/landing"
            />
          ) : null}
          {fields.showDeepLink ? (
            <Input
              label="Default deep_link_value"
              value={deepLinkValue}
              onChange={(e) => setDeepLinkValue(e.target.value)}
              placeholder="home/promo"
              mono
            />
          ) : null}
          {fields.showReferrer ? (
            <Input
              label="Default referrer code"
              value={referrerCode}
              onChange={(e) => setReferrerCode(e.target.value)}
              placeholder="friend123"
              mono
            />
          ) : null}
          {fields.showCampaignDefaults ? (
            <div className={styles.formRow}>
              <Input label="Default media source (pid)" value={mediaSource} onChange={(e) => setMediaSource(e.target.value)} />
              <Input label="Default campaign (c)" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} />
            </div>
          ) : null}
          {fields.showViewWindow ? (
            <Input
              label="View-through window (hours)"
              type="number"
              min={1}
              value={viewWindow}
              onChange={(e) => setViewWindow(e.target.value)}
            />
          ) : null}
          <Button type="submit" disabled={creating} size="sm" alignSelfStart>
            {creating ? "Creating…" : `Create ${meta.label}`}
          </Button>
        </form>
      </DashboardPanel>

      {loading ? <p>Loading…</p> : null}

      <DashboardPanel title={`${meta.label} links`}>
        {links.length === 0 ? (
          <p className={styles.emptyList}>No {meta.label} links yet.</p>
        ) : (
          <ul className={styles.linkList}>
            {links.map((link) => {
              const clickUrl = `${INGEST_BASE}/v1/l/${link.slug}`;
              const pixelUrl = `${INGEST_BASE}/v1/i/${link.slug}.gif`;
              const presets = parseCampaignPresets(link.campaign_presets_json);
              return (
                <li key={link.id} className={styles.linkItem}>
                  <strong>{link.name}</strong>
                  {fields.showPixel ? (
                    <>
                      <span className={styles.url}>Impression pixel: {pixelUrl}</span>
                      <code className={styles.url}>{`<img src="${pixelUrl}" width="1" height="1" alt="" />`}</code>
                      <Button type="button" size="sm" variant="secondary" onClick={() => void copyText(pixelUrl)}>
                        Copy pixel URL
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className={styles.url}>{clickUrl}</span>
                      <Button type="button" size="sm" variant="secondary" onClick={() => void copyText(clickUrl)}>
                        Copy link
                      </Button>
                    </>
                  )}
                  {presets.length > 0 ? (
                    <ul className={linkStyles.presetList}>
                      {presets.map((preset) => (
                        <li key={preset.id}>
                          <span>{preset.label}</span>
                          <code className={styles.url}>{buildTrackingLinkUrl(INGEST_BASE, link.slug, preset)}</code>
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
    </>
  );
}
