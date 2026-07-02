import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DataTable, DataTableEmpty } from "@/components/dashboard/data-table";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { getDb } from "@/lib/db";
import { getDeviceDb } from "@/lib/deviceDb";
import { getProjectForUser, listSkanPostbacks } from "@/lib/repos";
import styles from "../campaigns/page.module.scss";

export default async function SkanPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const db = getDb();
  const project = getProjectForUser(db, projectId, userId);
  if (!project) notFound();

  let rows: ReturnType<typeof listSkanPostbacks> = [];
  try {
    const deviceDb = getDeviceDb();
    rows = listSkanPostbacks(deviceDb, project.company_id);
  } catch {
    rows = [];
  }

  return (
    <div className={styles.root}>
      <DashboardPageHeader
        backHref={`/dashboard/${projectId}`}
        backLabel="Get started"
        eyebrow="iOS privacy"
        title="SKAdNetwork postbacks"
        description={
          <p>
            Aggregate iOS privacy channel data. Post to <code>POST /v1/skan/postback</code> with your API key.
          </p>
        }
      />

      <DataTable caption="SKAdNetwork postbacks">
        <thead>
          <tr>
            <th>Received</th>
            <th>Media source</th>
            <th>Campaign</th>
            <th>Conversion value</th>
            <th>Sequence</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <DataTableEmpty colSpan={5}>No SKAN postbacks yet.</DataTableEmpty>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.received_at).toLocaleString()}</td>
                <td>{row.media_source ?? "—"}</td>
                <td>{row.campaign_id ?? "—"}</td>
                <td>{row.conversion_value ?? "—"}</td>
                <td>{row.postback_sequence ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </DataTable>
    </div>
  );
}
