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

export type User = { id: string; email: string };

export type Project = {
  id: string;
  user_id: string;
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

export type TrackingLink = {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  destination_type: string;
  ios_url: string | null;
  android_url: string | null;
  web_url: string | null;
  default_params_json: string | null;
  campaign_presets_json: string | null;
  created_at: string;
};

export type CampaignSummaryRow = {
  media_source: string | null;
  campaign_id: string | null;
  adgroup_id: string | null;
  creative_id: string | null;
  installs: number;
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
  register(email: string, password: string) {
    return request<{ ok: boolean }>("/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
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
    return request<{ user: User }>("/v1/auth/me", { token });
  },
  listProjects(token: string) {
    return request<{ projects: Project[] }>("/v1/projects", { token });
  },
  createProject(token: string, name: string) {
    return request<{ project: Project }>("/v1/projects", {
      method: "POST",
      token,
      body: JSON.stringify({ name }),
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
    params: { page?: number; actionType?: string; event?: string; token?: string } = {},
  ) {
    const q = new URLSearchParams();
    if (params.page && params.page > 1) q.set("page", String(params.page));
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
  listLinks(token: string, projectId: string) {
    return request<{ links: TrackingLink[] }>(`/v1/projects/${projectId}/links`, { token });
  },
  createLink(
    token: string,
    projectId: string,
    body: { name: string; slug: string; iosUrl?: string; androidUrl?: string; webUrl?: string },
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
    return request<{ summary: CampaignSummaryRow[]; organic: { organic: number; non_organic: number } }>(
      `/v1/projects/${projectId}/campaigns/summary`,
      { token },
    );
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
