import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { getDb } from "@/lib/db";
import { getProjectForUser, listTrackingLinksForCompany } from "@/lib/repos";
import { LinksManager } from "./links-manager";
import styles from "../campaigns/page.module.scss";

export default async function LinksPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const db = getDb();
  const project = getProjectForUser(db, projectId, userId);
  if (!project) notFound();

  const links = listTrackingLinksForCompany(db, project.company_id);
  const ingestBaseUrl = process.env.NEXT_PUBLIC_INGEST_URL ?? "http://localhost:8080";

  return (
    <div className={styles.root}>
      <DashboardPageHeader
        backHref={`/dashboard/${projectId}`}
        backLabel="Get started"
        eyebrow="Campaigns"
        title="Campaign links"
        description={
          <p>
            OneLink-style URLs that record clicks before redirecting to App Store, Play Store, or your web landing page.
          </p>
        }
      />
      <LinksManager projectId={projectId} links={links} ingestBaseUrl={ingestBaseUrl} />
    </div>
  );
}
