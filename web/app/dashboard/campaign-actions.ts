"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import {
  createTrackingLink,
  deleteTrackingLinkForCompany,
  getProjectForUser,
  getTrackingLinkForCompany,
  updateTrackingLinkCampaignPresets,
  upsertAttributionSettingsRow,
} from "@/lib/repos";
import {
  parseCampaignPresets,
  type CampaignPresetInput,
  type LinkCampaignPreset,
} from "@/lib/tracking-link-presets";

export type CampaignActionResult = { ok: true } | { ok: false; error: string };

export async function createTrackingLinkAction(
  _prev: CampaignActionResult | undefined,
  formData: FormData
): Promise<CampaignActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const projectId = String(formData.get("projectId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!projectId || !name || !slug) return { ok: false, error: "Name and slug are required." };
  if (!/^[a-z0-9-]+$/.test(slug)) return { ok: false, error: "Slug must be lowercase alphanumeric with hyphens." };

  const db = getDb();
  const project = getProjectForUser(db, projectId, session.user.id);
  if (!project) return { ok: false, error: "Project not found." };

  try {
    createTrackingLink(db, {
      companyId: project.company_id,
      name,
      slug,
      destinationType: "multi",
      iosUrl: String(formData.get("iosUrl") ?? "").trim() || undefined,
      androidUrl: String(formData.get("androidUrl") ?? "").trim() || undefined,
      webUrl: String(formData.get("webUrl") ?? "").trim() || undefined,
    });
    revalidatePath(`/dashboard/${projectId}/links`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create link." };
  }
}

export async function deleteTrackingLinkAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  const projectId = String(formData.get("projectId") ?? "").trim();
  const linkId = String(formData.get("linkId") ?? "").trim();
  if (!projectId || !linkId) return;

  const db = getDb();
  const project = getProjectForUser(db, projectId, session.user.id);
  if (!project) return;

  deleteTrackingLinkForCompany(db, project.company_id, linkId);
  revalidatePath(`/dashboard/${projectId}/links`);
}

function readPresetInput(formData: FormData): CampaignPresetInput | { error: string } {
  const label = String(formData.get("label") ?? "").trim();
  const mediaSource = String(formData.get("mediaSource") ?? "").trim();
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  if (!label) return { error: "Preset label is required." };
  if (!mediaSource) return { error: "Media source (pid) is required." };
  if (!campaignId) return { error: "Campaign (c) is required." };
  return {
    label,
    mediaSource,
    campaignId,
    adgroupId: String(formData.get("adgroupId") ?? "").trim() || undefined,
    creativeId: String(formData.get("creativeId") ?? "").trim() || undefined,
    deepLinkValue: String(formData.get("deepLinkValue") ?? "").trim() || undefined,
  };
}

export async function addLinkCampaignPresetAction(
  _prev: CampaignActionResult | undefined,
  formData: FormData,
): Promise<CampaignActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const projectId = String(formData.get("projectId") ?? "").trim();
  const linkId = String(formData.get("linkId") ?? "").trim();
  if (!projectId || !linkId) return { ok: false, error: "Missing project or link." };

  const input = readPresetInput(formData);
  if ("error" in input) return { ok: false, error: input.error };

  const db = getDb();
  const project = getProjectForUser(db, projectId, session.user.id);
  if (!project) return { ok: false, error: "Project not found." };

  const link = getTrackingLinkForCompany(db, project.company_id, linkId);
  if (!link) return { ok: false, error: "Link not found." };

  const presets = parseCampaignPresets(link.campaign_presets_json);
  const next: LinkCampaignPreset[] = [
    ...presets,
    { id: crypto.randomUUID(), ...input },
  ];
  updateTrackingLinkCampaignPresets(db, project.company_id, linkId, JSON.stringify(next));
  revalidatePath(`/dashboard/${projectId}/links`);
  return { ok: true };
}

export async function deleteLinkCampaignPresetAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  const projectId = String(formData.get("projectId") ?? "").trim();
  const linkId = String(formData.get("linkId") ?? "").trim();
  const presetId = String(formData.get("presetId") ?? "").trim();
  if (!projectId || !linkId || !presetId) return;

  const db = getDb();
  const project = getProjectForUser(db, projectId, session.user.id);
  if (!project) return;

  const link = getTrackingLinkForCompany(db, project.company_id, linkId);
  if (!link) return;

  const presets = parseCampaignPresets(link.campaign_presets_json).filter((p) => p.id !== presetId);
  updateTrackingLinkCampaignPresets(db, project.company_id, linkId, JSON.stringify(presets));
  revalidatePath(`/dashboard/${projectId}/links`);
}

export async function saveAppSettingsAction(
  _prev: CampaignActionResult | undefined,
  formData: FormData
): Promise<CampaignActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const projectId = String(formData.get("projectId") ?? "").trim();
  const db = getDb();
  const project = getProjectForUser(db, projectId, session.user.id);
  if (!project) return { ok: false, error: "Project not found." };

  const certsRaw = String(formData.get("androidSha256Certs") ?? "").trim();
  const skanRaw = String(formData.get("skanIds") ?? "").trim();

  upsertAttributionSettingsRow(db, project.company_id, {
    iosAppId: String(formData.get("iosAppId") ?? "").trim() || undefined,
    androidPackage: String(formData.get("androidPackage") ?? "").trim() || undefined,
    iosTeamId: String(formData.get("iosTeamId") ?? "").trim() || undefined,
    associatedDomain: String(formData.get("associatedDomain") ?? "").trim() || undefined,
    partnerPostbackUrl: String(formData.get("partnerPostbackUrl") ?? "").trim() || undefined,
    androidSha256Certs: certsRaw ? certsRaw.split("\n").map((s) => s.trim()).filter(Boolean) : undefined,
    skanIds: skanRaw ? skanRaw.split("\n").map((s) => s.trim()).filter(Boolean) : undefined,
    installAttributionWindowHours: Number(formData.get("installWindowHours") ?? 24) || 24,
    enableProbabilisticMatching: formData.get("enableProbabilistic") === "on",
  });

  revalidatePath(`/dashboard/${projectId}/settings/apps`);
  return { ok: true };
}
