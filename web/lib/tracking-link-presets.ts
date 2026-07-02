export interface LinkCampaignPreset {
  id: string;
  label: string;
  mediaSource: string;
  campaignId: string;
  adgroupId?: string;
  creativeId?: string;
  deepLinkValue?: string;
}

export type CampaignPresetInput = Omit<LinkCampaignPreset, "id">;

export function parseCampaignPresets(json: string | null | undefined): LinkCampaignPreset[] {
  if (!json?.trim()) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    const items: LinkCampaignPreset[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const mediaSource = String(r.mediaSource ?? "").trim();
      const campaignId = String(r.campaignId ?? "").trim();
      const label = String(r.label ?? "").trim();
      if (!mediaSource || !campaignId || !label) continue;
      items.push({
        id: typeof r.id === "string" && r.id.trim() ? r.id.trim() : `${mediaSource}-${campaignId}-${label}`,
        label,
        mediaSource,
        campaignId,
        adgroupId: String(r.adgroupId ?? "").trim() || undefined,
        creativeId: String(r.creativeId ?? "").trim() || undefined,
        deepLinkValue: String(r.deepLinkValue ?? "").trim() || undefined,
      });
    }
    return items;
  } catch {
    return [];
  }
}

export function buildTrackingLinkUrl(
  ingestBaseUrl: string,
  slug: string,
  preset: Pick<LinkCampaignPreset, "mediaSource" | "campaignId" | "adgroupId" | "creativeId" | "deepLinkValue">,
): string {
  const base = `${ingestBaseUrl.replace(/\/$/, "")}/v1/l/${encodeURIComponent(slug)}`;
  const params = new URLSearchParams();
  params.set("pid", preset.mediaSource);
  params.set("c", preset.campaignId);
  if (preset.adgroupId) params.set("adset", preset.adgroupId);
  if (preset.creativeId) params.set("ad", preset.creativeId);
  if (preset.deepLinkValue) params.set("deep_link_value", preset.deepLinkValue);
  return `${base}?${params.toString()}`;
}
