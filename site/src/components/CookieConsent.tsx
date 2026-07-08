import { useEffect, useState } from "react";
import { initAnalytics } from "../lib/analytics";
import {
  getStoredConsent,
  hasConsentDecision,
  setConsent,
  subscribeConsent,
} from "../lib/cookie-consent";
import styles from "./CookieConsent.module.scss";

type CookieConsentProps = {
  onConsentApplied?: (analytics: boolean) => void;
};

export function CookieConsent({ onConsentApplied }: CookieConsentProps) {
  const [visible, setVisible] = useState(() => !hasConsentDecision());

  useEffect(() => {
    return subscribeConsent(() => setVisible(false));
  }, []);

  function apply(analytics: boolean) {
    setConsent(analytics);
    if (analytics) {
      initAnalytics();
    }
    onConsentApplied?.(analytics);
    setVisible(false);
  }

  if (!visible) return null;

  const stored = getStoredConsent();
  if (stored) return null;

  return (
    <div className={styles.banner} role="dialog" aria-labelledby="cookie-consent-title">
      <div className={styles.panel}>
        <p id="cookie-consent-title" className={styles.title}>
          We use cookies
        </p>
        <p className={styles.copy}>
          Essential cookies keep the site working. Analytics cookies help us understand how visitors
          use TrustTargets so we can improve the experience.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.acceptBtn} onClick={() => apply(true)}>
            Accept all
          </button>
          <button type="button" className={styles.essentialBtn} onClick={() => apply(false)}>
            Essential only
          </button>
        </div>
      </div>
    </div>
  );
}
