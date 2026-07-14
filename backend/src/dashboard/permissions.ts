export const ORG_TAB_KEYS = [
  "projects",
  "users",
  "get_started",
  "campaigns",
  "attribution",
  "links",
  "events",
  "app_settings",
  "skan",
] as const;

export type OrgTabKey = (typeof ORG_TAB_KEYS)[number];

export type OrgTabPermissions = Record<OrgTabKey, boolean>;

export const FULL_PERMISSIONS: OrgTabPermissions = {
  projects: true,
  users: true,
  get_started: true,
  campaigns: true,
  attribution: true,
  links: true,
  events: true,
  app_settings: true,
  skan: true,
};

export const RESTRICTIVE_DEFAULT: OrgTabPermissions = {
  projects: true,
  users: false,
  get_started: true,
  campaigns: false,
  attribution: false,
  links: false,
  events: false,
  app_settings: false,
  skan: false,
};

export function normalizePermissions(raw: unknown): OrgTabPermissions {
  const src =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw) as Record<string, unknown>;
          } catch {
            return {};
          }
        })()
      : raw && typeof raw === "object"
        ? (raw as Record<string, unknown>)
        : {};
  const out = { ...RESTRICTIVE_DEFAULT };
  for (const key of ORG_TAB_KEYS) {
    if (typeof src[key] === "boolean") out[key] = src[key];
  }
  return out;
}

export function mergePermissions(
  current: OrgTabPermissions,
  patch: Partial<OrgTabPermissions>,
): OrgTabPermissions {
  const out = { ...current };
  for (const key of ORG_TAB_KEYS) {
    if (typeof patch[key] === "boolean") out[key] = patch[key]!;
  }
  return out;
}

export function effectivePermissions(
  role: "owner" | "member" | null | undefined,
  stored: unknown,
): OrgTabPermissions {
  if (role === "owner") return { ...FULL_PERMISSIONS };
  return normalizePermissions(stored);
}

export function memberHasTab(
  role: "owner" | "member" | null | undefined,
  stored: unknown,
  tab: OrgTabKey,
): boolean {
  return effectivePermissions(role, stored)[tab];
}
