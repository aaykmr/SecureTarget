"use client";

import { Copy01Icon } from "@hugeicons/core-free-icons";
import { useActionState, useCallback } from "react";
import { toast } from "react-toastify";
import {
  addLinkCampaignPresetAction,
  deleteLinkCampaignPresetAction,
  type CampaignActionResult,
} from "@/app/dashboard/campaign-actions";
import { Button } from "@/components/ui/button";
import { HugeIcon } from "@/components/huge-icon";
import { Input } from "@/components/ui/input";
import {
  buildTrackingLinkUrl,
  type LinkCampaignPreset,
} from "@/lib/tracking-link-presets";
import styles from "./link-campaign-presets.module.scss";

export function LinkCampaignPresets({
  projectId,
  linkId,
  slug,
  ingestBaseUrl,
  presets,
}: {
  projectId: string;
  linkId: string;
  slug: string;
  ingestBaseUrl: string;
  presets: LinkCampaignPreset[];
}) {
  const [state, formAction, pending] = useActionState(addLinkCampaignPresetAction, undefined as
    | CampaignActionResult
    | undefined);

  const copyUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Copied tracking URL");
    } catch {
      toast.error("Could not copy");
    }
  }, []);

  return (
    <div className={styles.root}>
      {presets.length === 0 ? (
        <p className={styles.empty}>No campaign URLs yet. Add a media source and campaign below.</p>
      ) : (
        <ul className={styles.presetList}>
          {presets.map((preset) => {
            const url = buildTrackingLinkUrl(ingestBaseUrl, slug, preset);
            return (
              <li key={preset.id} className={styles.presetItem}>
                <div className={styles.presetHeader}>
                  <span className={styles.presetLabel}>{preset.label}</span>
                  <span className={styles.presetMeta}>
                    pid={preset.mediaSource} · c={preset.campaignId}
                    {preset.adgroupId ? ` · adset=${preset.adgroupId}` : ""}
                    {preset.creativeId ? ` · ad=${preset.creativeId}` : ""}
                  </span>
                </div>
                <div className={styles.urlRow}>
                  <code className={styles.url}>{url}</code>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    aria-label={`Copy ${preset.label} URL`}
                    onClick={() => void copyUrl(url)}
                  >
                    <HugeIcon icon={Copy01Icon} size={16} />
                  </button>
                </div>
                <form action={deleteLinkCampaignPresetAction}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="linkId" value={linkId} />
                  <input type="hidden" name="presetId" value={preset.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Remove
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      <form action={formAction} className={styles.addForm}>
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="linkId" value={linkId} />
        <p className={styles.addTitle}>Add campaign URL</p>
        <div className={styles.addGrid}>
          <Input name="label" label="Label" required placeholder="Facebook summer" />
          <Input name="mediaSource" label="Media source (pid)" required placeholder="facebook" mono />
          <Input name="campaignId" label="Campaign (c)" required placeholder="summer_sale" mono />
          <Input name="adgroupId" label="Ad set (adset)" placeholder="prospecting" mono />
          <Input name="creativeId" label="Creative (ad)" placeholder="video_01" mono />
          <Input name="deepLinkValue" label="Deep link value" placeholder="promo_screen" mono />
        </div>
        <Button type="submit" disabled={pending} size="sm" alignSelfStart>
          {pending ? "Adding…" : "Add campaign URL"}
        </Button>
        {state?.ok === false ? <p className={styles.error}>{state.error}</p> : null}
        {state?.ok ? <p className={styles.success}>Campaign URL added.</p> : null}
      </form>
    </div>
  );
}
