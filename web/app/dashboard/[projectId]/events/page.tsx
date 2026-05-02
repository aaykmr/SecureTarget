import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { countSdkEventsForCompany, getProjectForUser, listSdkEventsForCompany } from "@/lib/repos";
import { EventsExplorer } from "./events-explorer";
import styles from "./page.module.scss";

const PAGE_SIZE = 50;

export default async function ProjectEventsPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ page?: string; actionType?: string; event?: string }>;
}) {
  const { projectId } = await params;
  const sp = await searchParams;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }
  const db = getDb();
  const project = getProjectForUser(db, projectId, userId);
  if (!project) {
    notFound();
  }

  const allowedAction = new Set(["record", "login", "conversion", "custom"]);
  const initialActionType =
    typeof sp.actionType === "string" && allowedAction.has(sp.actionType) ? sp.actionType : "";
  const initialEventLabel =
    typeof sp.event === "string" ? sp.event.trim().slice(0, 500) : "";

  const listFilter = {
    ...(initialActionType ? { actionType: initialActionType } : {}),
    ...(initialEventLabel ? { eventLabel: initialEventLabel } : {})
  };

  const total = countSdkEventsForCompany(db, project.company_id, listFilter);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requested = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const page = Math.min(requested, totalPages);
  const offset = (page - 1) * PAGE_SIZE;

  const rows = listSdkEventsForCompany(db, project.company_id, {
    ...listFilter,
    limit: PAGE_SIZE,
    offset
  });

  return (
    <div className={styles.root}>
      <div>
        <Link href={`/dashboard/${projectId}`} className={styles.backLink}>
          ← Overview
        </Link>
        <h1 className={styles.title}>Events</h1>
        <p className={styles.lead}>
          Ingested SDK rows from <code className={styles.inlineCode}>sdk_events</code> for this project. Filter by the same opaque token you send in event payloads.
        </p>
      </div>

      <EventsExplorer
        projectId={projectId}
        initialRows={rows}
        initialTotal={total}
        initialPage={page}
        pageSize={PAGE_SIZE}
        initialActionType={initialActionType}
        initialEventLabel={initialEventLabel}
      />
    </div>
  );
}
