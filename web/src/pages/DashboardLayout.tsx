import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import styles from "./DashboardLayout.module.scss";

const RESERVED = new Set(["organizations", "users", "inquiries"]);

export function DashboardLayout() {
  const { user, loading, projects, currentProjectId, setCurrentProject } = useAuth();
  const { pathname } = useLocation();

  useEffect(() => {
    const match = pathname.match(/^\/dashboard\/([^/]+)/);
    const segment = match?.[1];
    if (!segment || RESERVED.has(segment)) return;
    if (segment === currentProjectId) return;
    const project = projects.find((p) => p.id === segment);
    if (project) setCurrentProject(project);
  }, [pathname, projects, currentProjectId, setCurrentProject]);

  if (loading) {
    return <p className={styles.loading}>Loading…</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className={styles.root}>
      <DashboardSidebar email={user.email} />
      <div className={styles.main}>
        <Outlet />
      </div>
    </div>
  );
}
