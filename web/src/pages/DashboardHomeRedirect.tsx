import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { DashboardPanel } from "@/components/dashboard/panel";
import styles from "./DashboardPage.module.scss";

/** Landing redirect: prefer project Get started, else Users, else empty cue. */
export function DashboardHomeRedirect() {
  const { loading, can, currentProjectId, isOrgOwner, currentOrganization } = useAuth();

  if (loading) {
    return (
      <div className={styles.root}>
        <DashboardPanel title="Dashboard">
          <p className={styles.empty}>Loading…</p>
        </DashboardPanel>
      </div>
    );
  }

  if (can("get_started") && currentProjectId) {
    return <Navigate to={`/dashboard/${currentProjectId}`} replace />;
  }
  if (can("users")) {
    return <Navigate to="/dashboard/users" replace />;
  }
  if (can("campaigns") && currentProjectId) {
    return <Navigate to={`/dashboard/${currentProjectId}/campaigns`} replace />;
  }

  return (
    <div className={styles.root}>
      <DashboardPageHeader
        eyebrow="Workspace"
        title="Dashboard"
        description={<p>Choose an organization and project in the sidebar to get started.</p>}
      />
      <DashboardPanel title="Getting started">
        {!currentOrganization ? (
          <p className={styles.empty}>Select an organization above to continue.</p>
        ) : !currentProjectId ? (
          <p className={styles.empty}>
            {isOrgOwner
              ? "Select or create a project from the project switcher."
              : "Ask an organization owner to grant project access or create a project."}
          </p>
        ) : (
          <p className={styles.empty}>You do not have access to any tabs in this organization.</p>
        )}
      </DashboardPanel>
    </div>
  );
}
