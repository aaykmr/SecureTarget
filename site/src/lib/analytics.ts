const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const SECTION_IDS = [
  "home",
  "about",
  "services",
  "advertisers",
  "publishers",
  "products",
  "contact",
] as const;

const SCROLL_MILESTONES = [25, 50, 75, 90, 100] as const;

type EventParams = Record<string, string | number | boolean | undefined>;

function isAnalyticsEnabled(): boolean {
  return Boolean(MEASUREMENT_ID);
}

export function trackEvent(name: string, params?: EventParams): void {
  if (!isAnalyticsEnabled()) return;
  window.gtag?.("event", name, params);
}

function trackPageView(path: string): void {
  if (!isAnalyticsEnabled()) return;
  window.gtag?.("config", MEASUREMENT_ID, { page_path: path });
}

export function trackCtaClick(label: string, location: string): void {
  trackEvent("cta_click", { cta_label: label, cta_location: location });
}

export function trackContactSubmit(): void {
  trackEvent("generate_lead", { form_name: "contact", method: "google_sheets" });
  trackEvent("contact_form_submit", { form_name: "contact" });
}

export function trackContactSuccess(): void {
  trackEvent("contact_form_success", { form_name: "contact" });
}

export function trackContactError(reason: string): void {
  trackEvent("contact_form_error", { form_name: "contact", error_reason: reason });
}

function initClickTracking(): void {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest("a");
    if (!(anchor instanceof HTMLAnchorElement)) return;

    const href = anchor.getAttribute("href") ?? "";
    const label = (anchor.dataset.cta || anchor.textContent || href).trim().slice(0, 80);
    const location = anchor.dataset.ctaLocation || "page";

    if (anchor.dataset.cta) {
      trackCtaClick(label, location);
    }

    if (href.startsWith("mailto:")) {
      trackEvent("mailto_click", {
        link_url: href,
        link_text: label,
        email: href.replace(/^mailto:/i, "").split("?")[0],
      });
      return;
    }

    if (href.startsWith("tel:")) {
      trackEvent("tel_click", {
        link_url: href,
        link_text: label,
      });
      return;
    }

    if (/^https?:\/\//i.test(href)) {
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) {
          trackEvent("outbound_click", {
            link_url: url.href,
            link_domain: url.hostname,
            link_text: label,
          });
        }
      } catch {
        // ignore invalid URLs
      }
    }
  });
}

function initScrollDepthTracking(): void {
  const reached = new Set<number>();

  const onScroll = () => {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;

    const percent = Math.min(100, Math.round((window.scrollY / scrollable) * 100));

    for (const milestone of SCROLL_MILESTONES) {
      if (percent >= milestone && !reached.has(milestone)) {
        reached.add(milestone);
        trackEvent("scroll_depth", {
          percent_scrolled: milestone,
          page_path: window.location.pathname + window.location.hash,
        });
      }
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function initSectionEngagementTracking(): void {
  const enteredAt = new Map<string, number>();

  const flushSection = (sectionId: string) => {
    const started = enteredAt.get(sectionId);
    if (started == null) return;

    const elapsedMs = Date.now() - started;
    enteredAt.delete(sectionId);
    if (elapsedMs < 1000) return;

    trackEvent("section_engagement", {
      section_id: sectionId,
      engagement_time_sec: Math.round(elapsedMs / 1000),
      engagement_time_msec: elapsedMs,
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const sectionId = entry.target.id;
        if (!sectionId) continue;

        if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
          if (!enteredAt.has(sectionId)) {
            enteredAt.set(sectionId, Date.now());
            trackEvent("section_view", { section_id: sectionId });
          }
        } else if (enteredAt.has(sectionId)) {
          flushSection(sectionId);
        }
      }
    },
    { threshold: [0, 0.35, 0.6] },
  );

  for (const id of SECTION_IDS) {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  }

  window.addEventListener("pagehide", () => {
    for (const sectionId of [...enteredAt.keys()]) {
      flushSection(sectionId);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      for (const sectionId of [...enteredAt.keys()]) {
        flushSection(sectionId);
      }
    }
  });
}

let engagementTrackingStarted = false;

/** Call once after the marketing page has mounted its sections. */
export function initEngagementTracking(): void {
  if (!isAnalyticsEnabled() || engagementTrackingStarted) return;
  engagementTrackingStarted = true;
  initSectionEngagementTracking();
}

export function initAnalytics(): void {
  if (!isAnalyticsEnabled()) return;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  trackPageView(window.location.pathname + window.location.hash);

  window.addEventListener("hashchange", () => {
    trackPageView(window.location.pathname + window.location.hash);
  });

  initClickTracking();
  initScrollDepthTracking();
}
