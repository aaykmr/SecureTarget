"use client";

import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import { startCashfreeSubscriptionAction } from "@/app/dashboard/actions";
import styles from "./cashfree-subscribe-button.module.scss";

type CashfreeFactory = (opts: { mode: "sandbox" | "production" }) => {
  subscriptionsCheckout: (opts: {
    subsSessionId: string;
    redirectTarget: "_self" | "_blank" | "_top";
  }) => Promise<{ error?: { message: string } } | void>;
};

declare global {
  interface Window {
    Cashfree?: CashfreeFactory;
  }
}

function cashfreeMode(): "sandbox" | "production" {
  return process.env.NEXT_PUBLIC_CASHFREE_ENV === "production" ? "production" : "sandbox";
}

function loadCashfreeScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Cashfree) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Cashfree.js"));
    document.body.appendChild(s);
  });
}

export function CashfreeSubscribeButton() {
  const [busy, setBusy] = useState(false);

  const onClick = useCallback(async () => {
    setBusy(true);
    try {
      const res = await startCashfreeSubscriptionAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      await loadCashfreeScript();
      const CF = window.Cashfree;
      if (!CF) {
        toast.error("Cashfree SDK failed to load.");
        return;
      }
      const cf = CF({ mode: cashfreeMode() });
      const result = await cf.subscriptionsCheckout({
        subsSessionId: res.subscriptionSessionId,
        redirectTarget: "_self",
      });
      if (result && typeof result === "object" && "error" in result && result.error?.message) {
        toast.error(result.error.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <button type="button" className={styles.btn} disabled={busy} onClick={() => void onClick()}>
      {busy ? "Starting checkout…" : "Open Cashfree subscription checkout"}
    </button>
  );
}
