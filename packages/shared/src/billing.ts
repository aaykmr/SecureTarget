/**
 * Cashfree subscription gate: when both client id and secret are set,
 * the dashboard and ingest require an active `billing_subscriptions` row
 * for the project owner (see web + backend integration).
 */
export function isCashfreeBillingEnforced(): boolean {
  if (typeof process === "undefined") return false;
  const id = process.env.CASHFREE_CLIENT_ID?.trim();
  const sec = process.env.CASHFREE_CLIENT_SECRET?.trim();
  return Boolean(id && sec);
}

/** Subscription states that allow API keys and ingest. */
export const CASHFREE_ACTIVE_SUBSCRIPTION_STATUSES = ["ACTIVE", "BANK_APPROVAL_PENDING"] as const;

export function isCashfreeSubscriptionStatusActive(status: string | null | undefined): boolean {
  if (!status) return false;
  return (CASHFREE_ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

/** After checkout is started but before the customer completes mandate (do not revoke keys on this alone). */
export function isCashfreeSubscriptionStatusPendingSetup(status: string | null | undefined): boolean {
  return status === "INITIALIZED";
}
