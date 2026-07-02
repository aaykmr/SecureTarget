import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { DashboardPanel } from "@/components/dashboard/panel";
import { getDb } from "@/lib/db";
import { getAttributionSettingsRow, getProjectForUser } from "@/lib/repos";
import { AppSettingsForm } from "./app-settings-form";
import styles from "../../campaigns/page.module.scss";

export default async function AppSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const db = getDb();
  const project = getProjectForUser(db, projectId, userId);
  if (!project) notFound();

  const settings = getAttributionSettingsRow(db, project.company_id) ?? null;
  const ingestBaseUrl = process.env.NEXT_PUBLIC_INGEST_URL ?? "http://localhost:8080";

  return (
    <div className={styles.root}>
      <DashboardPageHeader
        backHref={`/dashboard/${projectId}`}
        backLabel="Get started"
        eyebrow="Configuration"
        title="App settings"
        description={
          <p>Configure Universal Links, App Links, SKAN IDs, and attribution windows for this project.</p>
        }
      />
      <DashboardPanel>
        <AppSettingsForm
          projectId={projectId}
          companyId={project.company_id}
          ingestBaseUrl={ingestBaseUrl}
          settings={settings}
        />
      </DashboardPanel>
    </div>
  );
}
