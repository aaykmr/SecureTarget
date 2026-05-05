"use server";

import { hashToken, isCashfreeBillingEnforced, tokenSaltForCompany } from "@securetarget/shared";
import { randomUUID } from "node:crypto";
import { hashSync } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { cashfreeCreateSubscription } from "@/lib/cashfree";
import { getDb } from "@/lib/db";
import {
  countSdkEventsForCompany,
  createApiKeyForProject,
  createProject,
  createUser,
  findUserByEmail,
  getProjectForUser,
  listSdkEventsForCompany,
  revokeApiKey,
  upsertBillingCheckoutSession,
  userBillingAllowsProductUsage,
} from "@/lib/repos";
import type { SdkEventRow } from "@/lib/repos";

export type ActionResult = { ok: true; message?: string; apiKey?: string } | { ok: false; error: string };

export type CashfreeStartResult =
  | { ok: true; subscriptionSessionId: string }
  | { ok: false; error: string };

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
  if (isCashfreeBillingEnforced() && !userBillingAllowsProductUsage(db, session.user.id)) {
    return {
      ok: false,
      error: "An active Cashfree subscription is required to generate API keys. Complete billing on the dashboard.",
    };
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
  if (isCashfreeBillingEnforced() && !userBillingAllowsProductUsage(db, session.user.id)) {
    return {
      ok: false,
      error: "Events are unavailable until your subscription is active. API keys for your projects have been revoked after a failed or lapsed payment.",
    };
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

/** Creates a Cashfree subscription session and stores the merchant subscription id for webhook correlation. */
export async function startCashfreeSubscriptionAction(): Promise<CashfreeStartResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return { ok: false, error: "Unauthorized." };
  }
  if (!isCashfreeBillingEnforced()) {
    return { ok: false, error: "Cashfree billing is not configured (set CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET)." };
  }
  const planId = process.env.CASHFREE_PLAN_ID?.trim();
  if (!planId) {
    return { ok: false, error: "Set CASHFREE_PLAN_ID to your sandbox plan id from the Cashfree dashboard." };
  }
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (!appUrl) {
    return { ok: false, error: "Set NEXT_PUBLIC_APP_URL for subscription return_url." };
  }
  const db = getDb();
  const merchantSubscriptionId = `st_${randomUUID()}`;
  upsertBillingCheckoutSession(db, session.user.id, merchantSubscriptionId, session.user.email);
  const phone = process.env.CASHFREE_CUSTOMER_PHONE?.trim() || "9999999999";
  const name =
    session.user.name?.trim() ||
    session.user.email.split("@")[0]?.slice(0, 40) ||
    "Customer";
  const body = {
    subscription_id: merchantSubscriptionId,
    customer_details: {
      customer_name: name,
      customer_email: session.user.email,
      customer_phone: phone,
    },
    plan_details: { plan_id: planId },
    authorization_details: {
      authorization_amount: 1,
      authorization_amount_refund: true,
      payment_methods: ["upi", "card"],
    },
    subscription_meta: {
      return_url: `${appUrl}/dashboard`,
      notification_channel: ["EMAIL"],
    },
    subscription_expiry_time: "2099-12-31T23:59:59Z",
  };
  try {
    const { subscription_session_id } = await cashfreeCreateSubscription(body);
    if (!subscription_session_id) {
      return { ok: false, error: "Cashfree did not return subscription_session_id." };
    }
    return { ok: true, subscriptionSessionId: subscription_session_id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Cashfree request failed." };
  }
}
