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
};
