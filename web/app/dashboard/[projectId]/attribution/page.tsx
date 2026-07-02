import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DataTable, DataTableEmpty } from "@/components/dashboard/data-table";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { getDb } from "@/lib/db";
import { getProjectForUser, listInstallAttributions } from "@/lib/repos";
import styles from "../campaigns/page.module.scss";

export default async function AttributionPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const db = getDb();
  const project = getProjectForUser(db, projectId, userId);
  if (!project) notFound();

  const rows = listInstallAttributions(db, project.company_id);

  return (
    <div className={styles.root}>
      <DashboardPageHeader
        backHref={`/dashboard/${projectId}`}
        backLabel="Get started"
        eyebrow="Attribution"
        title="Install attribution log"
        description={<p>Per-install outcomes with match rule and confidence score.</p>}
      />

      <DataTable caption="Install attribution log">
        <thead>
          <tr>
            <th>Attributed at</th>
            <th>Media source</th>
            <th>Campaign</th>
            <th>Rule</th>
            <th>Confidence</th>
            <th>Organic</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <DataTableEmpty colSpan={6}>No install attributions recorded yet.</DataTableEmpty>
          ) : (
            rows.map((row) => (
              <tr key={row.attribution_id}>
                <td>{new Date(row.attributed_at).toLocaleString()}</td>
                <td>{row.media_source ?? "—"}</td>
                <td>{row.campaign_id ?? "—"}</td>
                <td>{row.match_rule ?? "—"}</td>
                <td>{(row.confidence * 100).toFixed(0)}%</td>
                <td>
                  <span className={row.is_organic ? styles.pill : `${styles.pill} ${styles.pillBrand}`}>
                    {row.is_organic ? "Organic" : "Non-organic"}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </DataTable>
    </div>
  );
}
