import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { CreateProjectModal } from "@/components/create-project-modal";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { DashboardPanel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import styles from "./DashboardPage.module.scss";

/** Landing redirect: prefer project Get started, else Users, else empty cue. */
export function DashboardHomeRedirect() {
  const { loading, can, currentProjectId, projects, isOrgOwner, currentOrganization } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const hasProjects = projects.length > 0;
  const canCreateProject = isOrgOwner && Boolean(currentOrganization);

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
  if (can("users") && hasProjects) {
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
        ) : !hasProjects ? (
          <div className={styles.emptyState}>
            <p className={styles.empty}>
              {canCreateProject
                ? "You don't have any projects yet. Create your first project to get started."
                : "There are no projects in this organization yet. Ask an organization owner to create one and grant you access."}
            </p>
            {canCreateProject ? (
              <Button size="sm" alignSelfStart onClick={() => setCreateOpen(true)}>
                Create a project
              </Button>
            ) : null}
          </div>
        ) : !currentProjectId ? (
          <p className={styles.empty}>Select a project from the project switcher.</p>
        ) : (
          <p className={styles.empty}>You do not have access to any tabs in this organization.</p>
        )}
      </DashboardPanel>

      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
