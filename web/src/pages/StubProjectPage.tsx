import { Link, useParams } from "react-router-dom";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { DashboardPanel } from "@/components/dashboard/panel";
import styles from "./StubProjectPage.module.scss";

export function StubProjectPage({ title }: { title: string }) {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <div className={styles.root}>
      <DashboardPageHeader
        backHref={projectId ? `/dashboard/${projectId}` : "/dashboard"}
        backLabel="Project"
        title={title}
        description={
          <p>
            This section is being migrated to the REST API. Project overview, API keys, and integration snippets are
            available now.
          </p>
        }
      />
      <DashboardPanel title="Coming soon">
        <p>
          Backend endpoints for {title.toLowerCase()} are not wired up yet. Deploy the backend with Postgres on EC2 and
          check <code>web/MIGRATION.md</code> for status.
        </p>
        {projectId ? (
          <p>
            <Link to={`/dashboard/${projectId}`}>Back to project overview</Link>
          </p>
        ) : null}
      </DashboardPanel>
    </div>
  );
}
