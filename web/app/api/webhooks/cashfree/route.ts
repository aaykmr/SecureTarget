import { createHmac, timingSafeEqual } from "node:crypto";
import {
  isCashfreeSubscriptionStatusActive,
  isCashfreeSubscriptionStatusPendingSetup,
} from "@securetarget/shared";
import { getDb } from "@/lib/db";
import {
  revokeAllApiKeysForUser,
  updateBillingSubscriptionFields,
} from "@/lib/repos";

function webhookSecret(): string | undefined {
  return (
    process.env.CASHFREE_WEBHOOK_SECRET?.trim() || process.env.CASHFREE_CLIENT_SECRET?.trim() || undefined
  );
}

function verifyCashfreeSignature(rawBody: string, signature: string | null, timestamp: string | null): boolean {
  const secret = webhookSecret();
  if (!secret || !signature || !timestamp) return false;
  const expected = createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
  try {
    const a = Buffer.from(signature, "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function applyPayload(db: ReturnType<typeof getDb>, payload: unknown): void {
  if (!payload || typeof payload !== "object") return;
  const p = payload as { type?: string; data?: Record<string, unknown> };
  const type = typeof p.type === "string" ? p.type.toUpperCase() : "";
  const d = p.data;
  if (!d || typeof d !== "object") return;

  if (type === "SUBSCRIPTION_STATUS_CHANGED") {
    const sd = d.subscription_details as Record<string, unknown> | undefined;
    if (!sd) return;
    const merchantId = sd.subscription_id;
    const st = sd.subscription_status;
    if (typeof merchantId !== "string" || typeof st !== "string") return;
    const cfId = typeof sd.cf_subscription_id === "string" ? sd.cf_subscription_id : null;
    const cd = d.customer_details as Record<string, unknown> | undefined;
    const em = cd && typeof cd.customer_email === "string" ? cd.customer_email : null;
    const userId = updateBillingSubscriptionFields(db, merchantId, {
      cf_subscription_id: cfId,
      status: st,
      customer_email: em,
    });
    if (
      userId &&
      !isCashfreeSubscriptionStatusActive(st) &&
      !isCashfreeSubscriptionStatusPendingSetup(st)
    ) {
      revokeAllApiKeysForUser(db, userId);
    }
    return;
  }

  if (type === "SUBSCRIPTION_PAYMENT_FAILED" || type === "SUBSCRIPTION_PAYMENT_CANCELLED") {
    const merchantId = d.subscription_id;
    if (typeof merchantId !== "string") return;
    const cfId = typeof d.cf_subscription_id === "string" ? d.cf_subscription_id : null;
    const userId = updateBillingSubscriptionFields(db, merchantId, {
      cf_subscription_id: cfId,
      status: "ON_HOLD",
    });
    if (userId) revokeAllApiKeysForUser(db, userId);
    return;
  }

  if (type === "SUBSCRIPTION_PAYMENT_SUCCESS") {
    const merchantId = d.subscription_id;
    if (typeof merchantId !== "string") return;
    const cfId = typeof d.cf_subscription_id === "string" ? d.cf_subscription_id : null;
    updateBillingSubscriptionFields(db, merchantId, {
      cf_subscription_id: cfId,
      status: "ACTIVE",
    });
  }
}

export async function POST(req: Request): Promise<Response> {
  const raw = await req.text();
  const sig = req.headers.get("x-webhook-signature");
  const ts = req.headers.get("x-webhook-timestamp");

  if (!webhookSecret()) {
    return new Response("Webhook secret not configured", { status: 503 });
  }

  if (!verifyCashfreeSignature(raw, sig, ts)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw) as unknown;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  try {
    const db = getDb();
    applyPayload(db, payload);
  } catch {
    return new Response("Internal error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
