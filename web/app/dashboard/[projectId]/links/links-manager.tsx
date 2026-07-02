"use client";

import { useActionState } from "react";
import { createTrackingLinkAction, deleteTrackingLinkAction } from "@/app/dashboard/campaign-actions";
import { DashboardPanel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseCampaignPresets } from "@/lib/tracking-link-presets";
import { LinkCampaignPresets } from "./link-campaign-presets";
import styles from "../campaigns/page.module.scss";
import linkStyles from "./links-manager.module.scss";

export interface LinkRow {
  id: string;
  name: string;
  slug: string;
  destination_type: string;
  ios_url: string | null;
  android_url: string | null;
  web_url: string | null;
  campaign_presets_json: string | null;
  created_at: string;
}

export function LinksManager({
  projectId,
  links,
  ingestBaseUrl,
}: {
  projectId: string;
  links: LinkRow[];
  ingestBaseUrl: string;
}) {
  const [state, formAction, pending] = useActionState(createTrackingLinkAction, undefined);

  return (
    <>
      <DashboardPanel title="Create link" lead="Slug must be lowercase letters, numbers, and hyphens only.">
        <form action={formAction} className={styles.form}>
          <input type="hidden" name="projectId" value={projectId} />
          <div className={styles.formRow}>
            <Input name="name" label="Name" required placeholder="Summer launch" />
            <Input name="slug" label="Slug" required placeholder="summer" pattern="[a-z0-9-]+" mono />
          </div>
          <div className={styles.formRow}>
            <Input
              name="iosUrl"
              type="url"
              label="iOS App Store URL"
              placeholder="https://apps.apple.com/..."
            />
            <Input
              name="androidUrl"
              type="url"
              label="Android Play URL"
              placeholder="https://play.google.com/store/apps/details?id=..."
            />
          </div>
          <Input
            name="webUrl"
            type="url"
            label="Web landing URL"
            placeholder="https://yoursite.com/landing"
          />
          <Button type="submit" disabled={pending} size="sm" alignSelfStart>
            {pending ? "Creating…" : "Create link"}
          </Button>
          {state?.ok === false ? <p className={styles.error}>{state.error}</p> : null}
          {state?.ok ? <p className={styles.success}>Link created.</p> : null}
        </form>
      </DashboardPanel>

      <DashboardPanel
        title="Active links"
        lead="Configure campaign URLs per media source. Each preset builds a full tracking link with pid, c, adset, ad, and deep_link_value."
      >
        {links.length === 0 ? (
          <p className={styles.emptyList}>No tracking links yet.</p>
        ) : (
          <ul className={linkStyles.linkCards}>
            {links.map((link) => (
              <li key={link.id} className={linkStyles.linkCard}>
                <div className={linkStyles.linkCardHeader}>
                  <div>
                    <strong className={linkStyles.linkName}>{link.name}</strong>
                    <span className={styles.muted}> ({link.slug})</span>
                  </div>
                  <form action={deleteTrackingLinkAction}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="linkId" value={link.id} />
                    <Button type="submit" variant="danger" size="sm">
                      Delete link
                    </Button>
                  </form>
                </div>
                <LinkCampaignPresets
                  projectId={projectId}
                  linkId={link.id}
                  slug={link.slug}
                  ingestBaseUrl={ingestBaseUrl}
                  presets={parseCampaignPresets(link.campaign_presets_json)}
                />
              </li>
            ))}
          </ul>
        )}
      </DashboardPanel>
    </>
  );
}
