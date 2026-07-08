const STORAGE_KEY = "tt_cookie_consent";

export type CookieConsentState = {
  analytics: boolean;
  decidedAt: string;
};

type ConsentListener = (state: CookieConsentState) => void;

const listeners = new Set<ConsentListener>();

function readStored(): CookieConsentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsentState;
    if (typeof parsed.analytics !== "boolean" || typeof parsed.decidedAt !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getStoredConsent(): CookieConsentState | null {
  return readStored();
}

export function hasConsentDecision(): boolean {
  return readStored() !== null;
}

export function getAnalyticsConsent(): boolean {
  return readStored()?.analytics === true;
}

export function setConsent(analytics: boolean): CookieConsentState {
  const state: CookieConsentState = {
    analytics,
    decidedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  for (const listener of listeners) {
    listener(state);
  }
  return state;
}

export function subscribeConsent(listener: ConsentListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
