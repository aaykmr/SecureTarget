import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
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
      <Link href={`/dashboard/${projectId}`} className={styles.backLink}>
        ← Back to project
      </Link>
      <h1 className={styles.title}>Install attribution log</h1>
      <p className={styles.lead}>Per-install attribution outcomes with match rule and confidence.</p>

      <table className={styles.table}>
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
            <tr>
              <td colSpan={6} className={styles.empty}>
                No install attributions recorded yet.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.attribution_id}>
                <td>{new Date(row.attributed_at).toLocaleString()}</td>
                <td>{row.media_source ?? "—"}</td>
                <td>{row.campaign_id ?? "—"}</td>
                <td>{row.match_rule ?? "—"}</td>
                <td>{(row.confidence * 100).toFixed(0)}%</td>
                <td>{row.is_organic ? "Yes" : "No"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
