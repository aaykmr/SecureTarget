export const LINK_TYPES = [
  "cta",
  "vta",
  "one_link",
  "hyperlink",
  "deeplink",
  "short_link",
  "ctv",
  "referral",
] as const;

export type LinkType = (typeof LINK_TYPES)[number];

export function isLinkType(value: unknown): value is LinkType {
  return typeof value === "string" && (LINK_TYPES as readonly string[]).includes(value);
}

export type LinkConfig = {
  referrerCode?: string;
  defaultDeepLinkValue?: string;
  viewThroughWindowHours?: number;
  /** Short-link / hyperlink / CTV destination override when not using ios/android/web columns */
  destinationUrl?: string;
};

export function parseLinkConfig(raw: unknown): LinkConfig {
  if (!raw) return {};
  const obj =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw) as Record<string, unknown>;
          } catch {
            return {};
          }
        })()
      : typeof raw === "object"
        ? (raw as Record<string, unknown>)
        : {};
  const out: LinkConfig = {};
  if (typeof obj.referrerCode === "string") out.referrerCode = obj.referrerCode;
  if (typeof obj.defaultDeepLinkValue === "string") out.defaultDeepLinkValue = obj.defaultDeepLinkValue;
  if (typeof obj.viewThroughWindowHours === "number") out.viewThroughWindowHours = obj.viewThroughWindowHours;
  if (typeof obj.destinationUrl === "string") out.destinationUrl = obj.destinationUrl;
  return out;
}

/** Map product link type to legacy destination_type string for compatibility. */
export function destinationTypeForLinkType(linkType: LinkType): string {
  switch (linkType) {
    case "one_link":
    case "deeplink":
    case "cta":
      return "multi";
    case "hyperlink":
    case "short_link":
    case "vta":
    case "ctv":
    case "referral":
      return "web";
    default:
      return "multi";
  }
}
