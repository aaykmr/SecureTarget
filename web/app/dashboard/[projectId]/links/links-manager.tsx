"use client";

import { useActionState } from "react";
import { createTrackingLinkAction, deleteTrackingLinkAction } from "@/app/dashboard/campaign-actions";
import styles from "../campaigns/page.module.scss";

export interface LinkRow {
  id: string;
  name: string;
  slug: string;
  destination_type: string;
  ios_url: string | null;
  android_url: string | null;
  web_url: string | null;
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
    <div className={styles.root}>
      <h1 className={styles.title}>Campaign links</h1>
      <p className={styles.lead}>
        OneLink-style URLs that record clicks before redirecting to App Store, Play Store, or your web landing page.
      </p>

      <form action={formAction} className={styles.form}>
        <input type="hidden" name="projectId" value={projectId} />
        <div className={styles.formRow}>
          <label>
            Name
            <input name="name" required placeholder="Summer launch" />
          </label>
          <label>
            Slug
            <input name="slug" required placeholder="summer" pattern="[a-z0-9-]+" />
          </label>
        </div>
        <div className={styles.formRow}>
          <label>
            iOS App Store URL
            <input name="iosUrl" type="url" placeholder="https://apps.apple.com/..." />
          </label>
          <label>
            Android Play URL
            <input name="androidUrl" type="url" placeholder="https://play.google.com/store/apps/details?id=..." />
          </label>
        </div>
        <label>
          Web landing URL
          <input name="webUrl" type="url" placeholder="https://yoursite.com/landing" />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create link"}
        </button>
        {state?.ok === false ? <p className={styles.error}>{state.error}</p> : null}
        {state?.ok ? <p className={styles.success}>Link created.</p> : null}
      </form>

      <ul className={styles.linkList}>
        {links.length === 0 ? (
          <li className={styles.empty}>No tracking links yet.</li>
        ) : (
          links.map((link) => {
            const trackingUrl = `${ingestBaseUrl.replace(/\/$/, "")}/v1/l/${link.slug}?pid=facebook&c=example`;
            return (
              <li key={link.id} className={styles.linkItem}>
                <div>
                  <strong>{link.name}</strong> <span className={styles.muted}>({link.slug})</span>
                </div>
                <code className={styles.url}>{trackingUrl}</code>
                <form action={deleteTrackingLinkAction}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="linkId" value={link.id} />
                  <button type="submit" className={styles.dangerBtn}>
                    Delete
                  </button>
                </form>
              </li>
            );
          })
        )}
      </ul>
      <p className={styles.lead}>
        Append query params: <code>pid</code> (media source), <code>c</code> (campaign), <code>adset</code>, <code>ad</code>,{" "}
        <code>deep_link_value</code>. AppsFlyer aliases <code>af_adset</code> / <code>af_ad</code> are supported.
      </p>
    </div>
  );
}
