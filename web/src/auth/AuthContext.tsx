import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  type Organization,
  type OrgTabKey,
  type OrgTabPermissions,
  type Project,
  type User,
} from "@/api/client";

const TOKEN_KEY = "st_auth_token";
const ORG_KEY = "st_current_org_id";
const PROJECT_KEY = "st_current_project_id";

const FULL: OrgTabPermissions = {
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

type AuthContextValue = {
  user: User | null;
  organizations: Organization[];
  currentOrganization: Organization | null;
  currentOrganizationId: string | null;
  setCurrentOrganizationId: (orgId: string | null) => void;
  setCurrentOrganization: (org: Organization) => void;
  projects: Project[];
  currentProject: Project | null;
  currentProjectId: string | null;
  setCurrentProject: (project: Project | null) => void;
  refreshProjects: () => Promise<void>;
  token: string | null;
  loading: boolean;
  isGlobalAdmin: boolean;
  isOrgOwner: boolean;
  currentOrgPermissions: OrgTabPermissions;
  can: (tab: OrgTabKey) => boolean;
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

function pickCurrentProject(
  projects: Project[],
  preferredId: string | null,
): Project | null {
  if (!projects.length) return null;
  if (preferredId) {
    const match = projects.find((p) => p.id === preferredId);
    if (match) return match;
  }
  return projects[0] ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganizationId, setCurrentOrganizationIdState] = useState<string | null>(() =>
    localStorage.getItem(ORG_KEY),
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(() =>
    localStorage.getItem(PROJECT_KEY),
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
    localStorage.removeItem(PROJECT_KEY);
    setCurrentProjectIdState(null);
    setProjects([]);
  }, []);

  const setCurrentOrganization = useCallback((org: Organization) => {
    localStorage.setItem(ORG_KEY, org.id);
    setCurrentOrganizationIdState(org.id);
    setOrganizations((prev) => (prev.some((o) => o.id === org.id) ? prev : [org, ...prev]));
    localStorage.removeItem(PROJECT_KEY);
    setCurrentProjectIdState(null);
    setProjects([]);
  }, []);

  const setCurrentProject = useCallback((project: Project | null) => {
    if (project) {
      localStorage.setItem(PROJECT_KEY, project.id);
      setCurrentProjectIdState(project.id);
      setProjects((prev) => (prev.some((p) => p.id === project.id) ? prev : [project, ...prev]));
    } else {
      localStorage.removeItem(PROJECT_KEY);
      setCurrentProjectIdState(null);
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    const t = localStorage.getItem(TOKEN_KEY);
    const orgId = localStorage.getItem(ORG_KEY);
    if (!t || !orgId) {
      setProjects([]);
      return;
    }
    try {
      const { projects: list } = await api.listProjects(t, orgId);
      setProjects(list);
      const preferred = localStorage.getItem(PROJECT_KEY);
      const picked = pickCurrentProject(list, preferred);
      if (picked) {
        localStorage.setItem(PROJECT_KEY, picked.id);
        setCurrentProjectIdState(picked.id);
      } else {
        localStorage.removeItem(PROJECT_KEY);
        setCurrentProjectIdState(null);
      }
    } catch {
      setProjects([]);
    }
  }, []);

  const refreshMe = useCallback(async () => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      setUser(null);
      setOrganizations([]);
      setProjects([]);
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
      setProjects([]);
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
        localStorage.removeItem(PROJECT_KEY);
        setCurrentOrganizationIdState(null);
        setCurrentProjectIdState(null);
        setProjects([]);
      })
      .finally(() => setLoading(false));
  }, [token, applyOrganizations]);

  useEffect(() => {
    if (!token || !currentOrganizationId) {
      setProjects([]);
      return;
    }
    void refreshProjects();
  }, [token, currentOrganizationId, refreshProjects]);

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
    localStorage.removeItem(PROJECT_KEY);
    setToken(null);
    setUser(null);
    setOrganizations([]);
    setProjects([]);
    setCurrentOrganizationIdState(null);
    setCurrentProjectIdState(null);
  }, []);

  const currentOrganization = useMemo(() => {
    if (!currentOrganizationId) return organizations[0] ?? null;
    return organizations.find((o) => o.id === currentOrganizationId) ?? organizations[0] ?? null;
  }, [organizations, currentOrganizationId]);

  const currentProject = useMemo(() => {
    if (!currentProjectId) return projects[0] ?? null;
    return projects.find((p) => p.id === currentProjectId) ?? projects[0] ?? null;
  }, [projects, currentProjectId]);

  const isGlobalAdmin = user?.role === "global_admin";
  const isOrgOwner = isGlobalAdmin || currentOrganization?.role === "owner";

  const currentOrgPermissions = useMemo(() => {
    if (isGlobalAdmin) return FULL;
    if (currentOrganization?.role === "owner") return FULL;
    return currentOrganization?.permissions ?? FULL;
  }, [isGlobalAdmin, currentOrganization]);

  const can = useCallback(
    (tab: OrgTabKey) => {
      if (isGlobalAdmin) return true;
      return Boolean(currentOrgPermissions[tab]);
    },
    [isGlobalAdmin, currentOrgPermissions],
  );

  const value = useMemo(
    () => ({
      user,
      organizations,
      currentOrganization,
      currentOrganizationId: currentOrganization?.id ?? null,
      setCurrentOrganizationId,
      setCurrentOrganization,
      projects,
      currentProject,
      currentProjectId: currentProject?.id ?? null,
      setCurrentProject,
      refreshProjects,
      token,
      loading,
      isGlobalAdmin,
      isOrgOwner,
      currentOrgPermissions,
      can,
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
      projects,
      currentProject,
      setCurrentProject,
      refreshProjects,
      token,
      loading,
      isGlobalAdmin,
      isOrgOwner,
      currentOrgPermissions,
      can,
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
