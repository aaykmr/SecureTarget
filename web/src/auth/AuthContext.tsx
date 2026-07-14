import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, type Organization, type User } from "@/api/client";

const TOKEN_KEY = "st_auth_token";
const ORG_KEY = "st_current_org_id";

type AuthContextValue = {
  user: User | null;
  organizations: Organization[];
  currentOrganization: Organization | null;
  currentOrganizationId: string | null;
  setCurrentOrganizationId: (orgId: string | null) => void;
  setCurrentOrganization: (org: Organization) => void;
  token: string | null;
  loading: boolean;
  isGlobalAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  setSession: (token: string, user: User) => Promise<void>;
  refreshMe: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function pickCurrentOrg(orgs: Organization[], preferredId: string | null): Organization | null {
  if (!orgs.length) return null;
  if (preferredId) {
    const match = orgs.find((o) => o.id === preferredId);
    if (match) return match;
  }
  return orgs[0] ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganizationId, setCurrentOrganizationIdState] = useState<string | null>(() =>
    localStorage.getItem(ORG_KEY),
  );
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  const applyOrganizations = useCallback((orgs: Organization[]) => {
    setOrganizations(orgs);
    const preferred = localStorage.getItem(ORG_KEY);
    const picked = pickCurrentOrg(orgs, preferred);
    if (picked) {
      localStorage.setItem(ORG_KEY, picked.id);
      setCurrentOrganizationIdState(picked.id);
    } else {
      localStorage.removeItem(ORG_KEY);
      setCurrentOrganizationIdState(null);
    }
  }, []);

  const setCurrentOrganizationId = useCallback((orgId: string | null) => {
    if (orgId) {
      localStorage.setItem(ORG_KEY, orgId);
    } else {
      localStorage.removeItem(ORG_KEY);
    }
    setCurrentOrganizationIdState(orgId);
  }, []);

  const setCurrentOrganization = useCallback((org: Organization) => {
    localStorage.setItem(ORG_KEY, org.id);
    setCurrentOrganizationIdState(org.id);
    setOrganizations((prev) => (prev.some((o) => o.id === org.id) ? prev : [org, ...prev]));
  }, []);

  const refreshMe = useCallback(async () => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      setUser(null);
      setOrganizations([]);
      return;
    }
    const { user: u, organizations: orgs } = await api.me(t);
    setUser(u);
    applyOrganizations(orgs ?? []);
  }, [applyOrganizations]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setUser(null);
      setOrganizations([]);
      return;
    }
    api
      .me(token)
      .then(({ user: u, organizations: orgs }) => {
        setUser(u);
        applyOrganizations(orgs ?? []);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
        setOrganizations([]);
        localStorage.removeItem(ORG_KEY);
        setCurrentOrganizationIdState(null);
      })
      .finally(() => setLoading(false));
  }, [token, applyOrganizations]);

  const setSession = useCallback(
    async (t: string, u: User) => {
      localStorage.setItem(TOKEN_KEY, t);
      setToken(t);
      setUser(u);
      try {
        const { organizations: orgs } = await api.me(t);
        applyOrganizations(orgs ?? []);
      } catch {
        setOrganizations([]);
      }
    },
    [applyOrganizations],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const { token: t, user: u } = await api.login(email, password);
      await setSession(t, u);
    },
    [setSession],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ORG_KEY);
    setToken(null);
    setUser(null);
    setOrganizations([]);
    setCurrentOrganizationIdState(null);
  }, []);

  const currentOrganization = useMemo(() => {
    if (!currentOrganizationId) return organizations[0] ?? null;
    return organizations.find((o) => o.id === currentOrganizationId) ?? organizations[0] ?? null;
  }, [organizations, currentOrganizationId]);

  const value = useMemo(
    () => ({
      user,
      organizations,
      currentOrganization,
      currentOrganizationId: currentOrganization?.id ?? null,
      setCurrentOrganizationId,
      setCurrentOrganization,
      token,
      loading,
      isGlobalAdmin: user?.role === "global_admin",
      login,
      setSession,
      refreshMe,
      logout,
    }),
    [
      user,
      organizations,
      currentOrganization,
      setCurrentOrganizationId,
      setCurrentOrganization,
      token,
      loading,
      login,
      setSession,
      refreshMe,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
