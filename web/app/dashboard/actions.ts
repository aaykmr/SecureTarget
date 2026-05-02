"use server";

import { hashToken, tokenSaltForCompany } from "@securetarget/shared";
import { hashSync } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import {
  countSdkEventsForCompany,
  createApiKeyForProject,
  createProject,
  createUser,
  findUserByEmail,
  getProjectForUser,
  listSdkEventsForCompany,
  revokeApiKey
} from "@/lib/repos";
import type { SdkEventRow } from "@/lib/repos";

export type ActionResult = { ok: true; message?: string; apiKey?: string } | { ok: false; error: string };

export async function registerAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  const db = getDb();
  if (findUserByEmail(db, email)) {
    return { ok: false, error: "An account with this email already exists." };
  }
  const passwordHash = hashSync(password, 10);
  createUser(db, email, passwordHash);
  return { ok: true, message: "Account created. You can sign in now." };
}

export async function createProjectAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Unauthorized." };
  }
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { ok: false, error: "Project name is required." };
  }
  const db = getDb();
  createProject(db, session.user.id, name);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function createApiKeyAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Unauthorized." };
  }
  if (!projectId) {
    return { ok: false, error: "Missing project." };
  }
  const db = getDb();
  const project = getProjectForUser(db, projectId, session.user.id);
  if (!project) {
    return { ok: false, error: "Project not found." };
  }
  const { fullKey } = createApiKeyForProject(db, projectId);
  revalidatePath(`/dashboard/${projectId}`);
  revalidatePath("/dashboard");
  return { ok: true, apiKey: fullKey, message: "Save this key now. It will not be shown again." };
}

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const keyId = String(formData.get("keyId") ?? "").trim();
  const session = await auth();
  if (!session?.user?.id) {
    return;
  }
  if (!projectId || !keyId) {
    return;
  }
  const db = getDb();
  const ok = revokeApiKey(db, keyId, projectId, session.user.id);
  if (!ok) {
    return;
  }
  revalidatePath(`/dashboard/${projectId}`);
}

const SDK_EVENTS_PAGE_SIZE = 50;

export type FetchSdkEventsResult =
  | { ok: true; rows: SdkEventRow[]; total: number; page: number; pageSize: number }
  | { ok: false; error: string };

/** Load `sdk_events` for a project. Optional `token` is the same opaque value sent in ingest; it is hashed server-side and never logged. */
const ALLOWED_SDK_ACTION_TYPES = new Set(["record", "login", "conversion", "custom"]);

export async function fetchSdkEventsAction(
  projectId: string,
  options: { page: number; token?: string; actionType?: string; eventLabel?: string }
): Promise<FetchSdkEventsResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Unauthorized." };
  }
  const db = getDb();
  const project = getProjectForUser(db, projectId, session.user.id);
  if (!project) {
    return { ok: false, error: "Project not found." };
  }

  const page = Math.max(1, options.page);
  const offset = (page - 1) * SDK_EVENTS_PAGE_SIZE;
  const raw = options.token?.trim();
  let tokenHash: string | undefined;
  if (raw) {
    const salt = tokenSaltForCompany(project.company_id);
    tokenHash = hashToken(raw, salt);
  }

  const rawAction = options.actionType?.trim();
  const actionType =
    rawAction && ALLOWED_SDK_ACTION_TYPES.has(rawAction) ? rawAction : undefined;
  const eventLabelRaw = options.eventLabel?.trim().slice(0, 500);
  const eventLabel = eventLabelRaw || undefined;

  const filter = {
    tokenHash,
    actionType,
    eventLabel
  };

  const total = countSdkEventsForCompany(db, project.company_id, filter);
  const rows = listSdkEventsForCompany(db, project.company_id, {
    ...filter,
    limit: SDK_EVENTS_PAGE_SIZE,
    offset
  });

  return { ok: true, rows, total, page, pageSize: SDK_EVENTS_PAGE_SIZE };
}
