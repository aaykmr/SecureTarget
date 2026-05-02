import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { countSdkEventsForCompany, getProjectForUser, listSdkEventsForCompany } from "@/lib/repos";
import { EventsExplorer } from "./events-explorer";

const PAGE_SIZE = 50;

export default async function ProjectEventsPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ page?: string }>;
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

  const total = countSdkEventsForCompany(db, project.company_id);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requested = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const page = Math.min(requested, totalPages);
  const offset = (page - 1) * PAGE_SIZE;

  const rows = listSdkEventsForCompany(db, project.company_id, {
    limit: PAGE_SIZE,
    offset
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/dashboard/${projectId}`} className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          ← Overview
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Events</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Ingested SDK rows from <code className="font-mono text-xs">sdk_events</code> for this project. Filter by the same opaque token you send in event payloads.
        </p>
      </div>

      <EventsExplorer
        projectId={projectId}
        initialRows={rows}
        initialTotal={total}
        initialPage={page}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
