const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error ?? res.statusText, res.status);
  }
  return data;
}

export type UserRole = "global_admin" | "member";

export type OrgTabKey =
  | "projects"
  | "users"
  | "get_started"
  | "campaigns"
  | "attribution"
  | "links"
  | "events"
  | "app_settings"
  | "skan";

export type OrgTabPermissions = Record<OrgTabKey, boolean>;

export const ORG_TAB_KEYS: OrgTabKey[] = [
  "projects",
  "users",
  "get_started",
  "campaigns",
  "attribution",
  "links",
  "events",
  "app_settings",
  "skan",
];

export const ORG_TAB_LABELS: Record<OrgTabKey, string> = {
  projects: "Projects",
  users: "Users",
  get_started: "Get started",
  campaigns: "Campaigns",
  attribution: "Attribution",
  links: "Links",
  events: "Events",
  app_settings: "App settings",
  skan: "SKAN",
};

export type User = { id: string; email: string; role: UserRole };

export type Organization = {
  id: string;
  name: string;
  created_by_user_id: string | null;
  created_at: string;
  role?: "owner" | "member" | null;
  permissions?: OrgTabPermissions;
};

export type OrgMember = {
  organization_id: string;
  user_id: string;
  role: "owner" | "member";
  email: string;
  created_at: string;
  permissions: OrgTabPermissions;
};

export type PendingInvite = {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
};

export type WaitlistInquiry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  organization: string;
  message: string;
  created_organization_id: string | null;
  disabled_at: string | null;
  created_at: string;
};

export type Project = {
  id: string;
  user_id: string;
  organization_id: string | null;
  name: string;
  company_id: string;
  created_at: string;
};

export type ApiKey = {
  id: string;
  project_id: string;
  key_prefix: string;
  created_at: string;
  revoked_at: string | null;
};

export type SdkEvent = {
  id: string;
  company_id: string;
  event_type: string;
  token_hash: string | null;
  payload_json: string;
  created_at: string;
};

export type LinkType =
  | "cta"
  | "vta"
  | "one_link"
  | "hyperlink"
  | "deeplink"
  | "short_link"
  | "ctv"
  | "referral";

export type TrackingLink = {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  destination_type: string;
  link_type: LinkType;
  ios_url: string | null;
  android_url: string | null;
  web_url: string | null;
  default_params_json: string | null;
  campaign_presets_json: string | null;
  config_json: string | null;
  created_at: string;
};

export type CampaignSummaryRow = {
  media_source: string | null;
  campaign_id: string | null;
  adgroup_id: string | null;
  creative_id: string | null;
  channel: string | null;
  link_type: string | null;
  clicks: number;
  impressions: number;
  installs: number;
  cta_installs: number;
  vta_installs: number;
  conversions: number;
  revenue: number;
  cost: number;
};

export type InstallAttribution = {
  attribution_id: string;
  install_event_id: string;
  attributed_at: string;
  confidence: number;
  match_rule: string | null;
  is_organic: boolean | null;
  media_source: string | null;
  campaign_id: string | null;
  adgroup_id: string | null;
  creative_id: string | null;
};

export type SkanPostback = {
  id: string;
  campaign_id: string | null;
  media_source: string | null;
  conversion_value: number | null;
  postback_sequence: number | null;
  received_at: string;
};

export type AttributionSettings = {
  installAttributionWindowHours: number;
  conversionAttributionWindowHours: number;
  reengagementWindowHours: number;
  viewThroughAttributionWindowHours: number;
  enableProbabilisticMatching: boolean;
  probabilisticMinConfidence: number;
  iosAppId: string | null;
  androidPackage: string | null;
  iosTeamId: string | null;
  androidSha256Certs: string[];
  associatedDomain: string | null;
  skanIds: string[];
  partnerPostbackUrl: string | null;
};

export const api = {
  signUpInternal(email: string, password: string, confirmPassword: string) {
    return request<{ token: string; user: User }>("/v1/auth/sign-up-internal", {
      method: "POST",
      body: JSON.stringify({ email, password, confirmPassword }),
    });
  },
  acceptInvite(token: string, password: string, confirmPassword: string) {
    return request<{ token: string; user: User }>("/v1/auth/accept-invite", {
      method: "POST",
      body: JSON.stringify({ token, password, confirmPassword }),
    });
  },
  getInvite(token: string) {
    return request<{
      invite: { email: string; organizationName: string; expiresAt: string };
    }>(`/v1/invites/${encodeURIComponent(token)}`);
  },
  login(email: string, password: string) {
    return request<{ token: string; user: User }>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  forgotPassword(email: string) {
    return request<{ ok: boolean }>("/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  resetPassword(token: string, password: string) {
    return request<{ ok: boolean; message?: string }>("/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
  },
  me(token: string) {
    return request<{ user: User; organizations: Organization[] }>("/v1/auth/me", { token });
  },
  listOrganizations(token: string) {
    return request<{ organizations: Organization[] }>("/v1/organizations", { token });
  },
  searchOrganizations(
    token: string,
    params: { q?: string; page?: number; pageSize?: number } = {},
  ) {
    const q = new URLSearchParams();
    q.set("page", String(params.page ?? 1));
    q.set("pageSize", String(params.pageSize ?? 20));
    if (params.q) q.set("q", params.q);
    return request<{
      organizations: Organization[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(`/v1/organizations?${q.toString()}`, { token });
  },
  createOrganization(token: string, name: string) {
    return request<{ organization: Organization }>("/v1/organizations", {
      method: "POST",
      token,
      body: JSON.stringify({ name }),
    });
  },
  getOrganization(token: string, orgId: string) {
    return request<{ organization: Organization }>(`/v1/organizations/${orgId}`, { token });
  },
  listOrgMembers(token: string, orgId: string) {
    return request<{ members: OrgMember[]; pendingInvites: PendingInvite[] }>(
      `/v1/organizations/${orgId}/members`,
      { token },
    );
  },
  inviteToOrganization(token: string, orgId: string, email: string) {
    return request<{
      invite: { id: string; email: string; expiresAt: string };
      inviteUrl: string;
      emailSent: boolean;
      emailError: string | null;
    }>(`/v1/organizations/${orgId}/invites`, {
      method: "POST",
      token,
      body: JSON.stringify({ email }),
    });
  },
  updateMemberPermissions(
    token: string,
    orgId: string,
    userId: string,
    permissions: Partial<OrgTabPermissions>,
  ) {
    return request<{ member: OrgMember }>(`/v1/organizations/${orgId}/members/${userId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ permissions }),
    });
  },
  submitWaitlist(body: {
    name: string;
    email: string;
    phone?: string;
    organization: string;
    message?: string;
  }) {
    return request<{ ok: boolean; id: string }>("/v1/waitlist", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  listWaitlist(
    token: string,
    params: {
      q?: string;
      page?: number;
      pageSize?: number;
      status?: "all" | "open" | "converted" | "disabled";
    } = {},
  ) {
    const q = new URLSearchParams();
    if (params.q) q.set("q", params.q);
    if (params.page && params.page > 1) q.set("page", String(params.page));
    if (params.pageSize) q.set("pageSize", String(params.pageSize));
    if (params.status && params.status !== "all") q.set("status", params.status);
    const qs = q.toString();
    return request<{
      inquiries: WaitlistInquiry[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(`/v1/waitlist${qs ? `?${qs}` : ""}`, { token });
  },
  setWaitlistDisabled(token: string, inquiryId: string, disabled: boolean) {
    return request<{ inquiry: WaitlistInquiry }>(`/v1/waitlist/${inquiryId}/disable`, {
      method: "POST",
      token,
      body: JSON.stringify({ disabled }),
    });
  },
  createOrganizationFromInquiry(token: string, inquiryId: string, name?: string) {
    return request<{ organization: Organization; inquiryId: string }>(
      `/v1/waitlist/${inquiryId}/create-organization`,
      {
        method: "POST",
        token,
        body: JSON.stringify(name ? { name } : {}),
      },
    );
  },
  listProjects(token: string, organizationId?: string) {
    const q = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
    return request<{ projects: Project[] }>(`/v1/projects${q}`, { token });
  },
  createProject(token: string, name: string, organizationId: string) {
    return request<{ project: Project }>("/v1/projects", {
      method: "POST",
      token,
      body: JSON.stringify({ name, organizationId }),
    });
  },
  getProject(token: string, projectId: string) {
    return request<{ project: Project }>(`/v1/projects/${projectId}`, { token });
  },
  listApiKeys(token: string, projectId: string) {
    return request<{ apiKeys: ApiKey[] }>(`/v1/projects/${projectId}/api-keys`, { token });
  },
  createApiKey(token: string, projectId: string) {
    return request<{ apiKey: ApiKey; fullKey: string }>(`/v1/projects/${projectId}/api-keys`, {
      method: "POST",
      token,
    });
  },
  revokeApiKey(token: string, projectId: string, keyId: string) {
    return request<{ ok: boolean }>(`/v1/projects/${projectId}/api-keys/${keyId}`, {
      method: "DELETE",
      token,
    });
  },
  listEvents(
    token: string,
    projectId: string,
    params: { page?: number; pageSize?: number; actionType?: string; event?: string; token?: string } = {},
  ) {
    const q = new URLSearchParams();
    if (params.page && params.page > 1) q.set("page", String(params.page));
    if (params.pageSize) q.set("pageSize", String(params.pageSize));
    if (params.actionType) q.set("actionType", params.actionType);
    if (params.event) q.set("event", params.event);
    if (params.token) q.set("token", params.token);
    const qs = q.toString();
    return request<{
      events: SdkEvent[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(`/v1/projects/${projectId}/events${qs ? `?${qs}` : ""}`, { token });
  },
  listLinks(token: string, projectId: string, linkType?: LinkType) {
    const q = linkType ? `?linkType=${encodeURIComponent(linkType)}` : "";
    return request<{ links: TrackingLink[] }>(`/v1/projects/${projectId}/links${q}`, { token });
  },
  createLink(
    token: string,
    projectId: string,
    body: {
      name: string;
      slug: string;
      linkType?: LinkType;
      iosUrl?: string;
      androidUrl?: string;
      webUrl?: string;
      destinationUrl?: string;
      mediaSource?: string;
      campaignId?: string;
      channel?: string;
      referrerCode?: string;
      defaultDeepLinkValue?: string;
      viewThroughWindowHours?: number;
    },
  ) {
    return request<{ link: TrackingLink }>(`/v1/projects/${projectId}/links`, {
      method: "POST",
      token,
      body: JSON.stringify(body),
    });
  },
  deleteLink(token: string, projectId: string, linkId: string) {
    return request<{ ok: boolean }>(`/v1/projects/${projectId}/links/${linkId}`, {
      method: "DELETE",
      token,
    });
  },
  addLinkPreset(
    token: string,
    projectId: string,
    linkId: string,
    body: {
      label: string;
      mediaSource: string;
      campaignId: string;
      adgroupId?: string;
      creativeId?: string;
      deepLinkValue?: string;
    },
  ) {
    return request<{ ok: boolean }>(`/v1/projects/${projectId}/links/${linkId}/presets`, {
      method: "POST",
      token,
      body: JSON.stringify(body),
    });
  },
  deleteLinkPreset(token: string, projectId: string, linkId: string, presetId: string) {
    return request<{ ok: boolean }>(`/v1/projects/${projectId}/links/${linkId}/presets/${presetId}`, {
      method: "DELETE",
      token,
    });
  },
  getSettings(token: string, projectId: string) {
    return request<{ settings: AttributionSettings; companyId: string }>(
      `/v1/projects/${projectId}/settings`,
      { token },
    );
  },
  saveSettings(token: string, projectId: string, settings: Partial<AttributionSettings>) {
    return request<{ ok: boolean }>(`/v1/projects/${projectId}/settings`, {
      method: "PUT",
      token,
      body: JSON.stringify(settings),
    });
  },
  getCampaignSummary(token: string, projectId: string) {
    return request<{
      summary: CampaignSummaryRow[];
      organic: {
        organic: number;
        non_organic: number;
        clicks: number;
        impressions: number;
        cta_installs: number;
        vta_installs: number;
      };
    }>(`/v1/projects/${projectId}/campaigns/summary`, { token });
  },
  listInstallAttributions(token: string, projectId: string, limit = 50) {
    return request<{ installs: InstallAttribution[] }>(
      `/v1/projects/${projectId}/attribution/installs?limit=${limit}`,
      { token },
    );
  },
  listSkanPostbacks(token: string, projectId: string, limit = 50) {
    return request<{ postbacks: SkanPostback[] }>(
      `/v1/projects/${projectId}/skan/postbacks?limit=${limit}`,
      { token },
    );
  },
};
