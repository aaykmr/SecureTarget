import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Project } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { CreateProjectForm } from "@/components/dashboard/create-project-form";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { DashboardPanel } from "@/components/dashboard/panel";
import styles from "./DashboardPage.module.scss";

export function DashboardPage() {
  const { token, currentOrganizationId } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const { projects: list } = await api.listProjects(token, currentOrganizationId ?? undefined);
      setProjects(list);
    } catch {
      setError("Could not load projects.");
    } finally {
      setLoading(false);
    }
  }, [token, currentOrganizationId]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  return (
    <div className={styles.root}>
      <DashboardPageHeader
        eyebrow="Workspace"
        title="Projects"
        description={
          <p>
            Each project has a <code>companyId</code> used in the SDK. Create an API key on the project overview page.
          </p>
        }
      />

      <CreateProjectForm onCreated={loadProjects} />

      <DashboardPanel title="Your projects">
        {loading ? (
          <p className={styles.empty}>Loading…</p>
        ) : error ? (
          <p className={styles.empty}>{error}</p>
        ) : projects.length === 0 ? (
          <p className={styles.empty}>No projects yet. Create one above.</p>
        ) : (
          <ul className={styles.list}>
            {projects.map((p) => (
              <li key={p.id}>
                <Link to={`/dashboard/${p.id}`} className={styles.projectLink}>
                  <span className={styles.projectName}>{p.name}</span>
                  <span className={styles.projectId}>{p.company_id}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DashboardPanel>
    </div>
  );
}
