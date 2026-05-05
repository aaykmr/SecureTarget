const CASHFREE_API_VERSION = "2025-08-01";

export function cashfreePgBaseUrl(): string {
  const env = process.env.CASHFREE_ENV?.trim().toLowerCase();
  if (env === "production") return "https://api.cashfree.com/pg";
  return "https://sandbox.cashfree.com/pg";
}

export async function cashfreeCreateSubscription(body: unknown): Promise<{
  subscription_session_id?: string;
}> {
  const id = process.env.CASHFREE_CLIENT_ID?.trim();
  const sec = process.env.CASHFREE_CLIENT_SECRET?.trim();
  if (!id || !sec) {
    throw new Error("Cashfree client id/secret are not configured.");
  }
  const res = await fetch(`${cashfreePgBaseUrl()}/subscriptions`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-version": CASHFREE_API_VERSION,
      "x-client-id": id,
      "x-client-secret": sec,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* not json */
  }
  if (!res.ok) {
    const msg =
      typeof json.message === "string"
        ? json.message
        : typeof json.error === "string"
          ? json.error
          : text.slice(0, 400);
    throw new Error(msg || `Cashfree HTTP ${res.status}`);
  }
  const sid = json.subscription_session_id;
  return { subscription_session_id: typeof sid === "string" ? sid : undefined };
}
