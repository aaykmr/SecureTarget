import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
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
    <div>
      <Link href={`/dashboard/${projectId}`} className={styles.backLink}>
        ← Back to project
      </Link>
      <LinksManager
        projectId={projectId}
        links={links}
        ingestBaseUrl={ingestBaseUrl}
      />
    </div>
  );
}
