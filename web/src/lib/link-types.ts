import type { LinkType } from "@/api/client";

export const LINK_TYPE_NAV: { type: LinkType; segment: string; label: string; description: string }[] = [
  { type: "cta", segment: "cta", label: "CTA", description: "Click-through attribution links." },
  { type: "vta", segment: "vta", label: "VTA", description: "View-through impression pixels." },
  { type: "one_link", segment: "one-link", label: "One Link", description: "Multi-destination iOS / Android / web." },
  { type: "hyperlink", segment: "hyperlink", label: "Hyperlink", description: "Simple web redirects." },
  { type: "deeplink", segment: "deeplink", label: "Deeplink", description: "App deep links with deep_link_value." },
  { type: "short_link", segment: "short-link", label: "Short Link", description: "Short slug to a destination URL." },
  { type: "ctv", segment: "ctv", label: "CTV", description: "Connected TV campaign links." },
  { type: "referral", segment: "referral", label: "Referral", description: "Referral / invite links with ref codes." },
];

export function linkTypeFromSegment(segment: string | undefined): LinkType | null {
  const found = LINK_TYPE_NAV.find((t) => t.segment === segment);
  return found?.type ?? null;
}
