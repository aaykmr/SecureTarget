import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
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
      <Link href={`/dashboard/${projectId}`} className={styles.backLink}>
        ← Back to project
      </Link>
      <h1 className={styles.title}>SKAdNetwork postbacks</h1>
      <p className={styles.lead}>
        Aggregate iOS privacy channel data. Post to{" "}
        <code>POST /v1/skan/postback</code> with your API key.
      </p>

      <table className={styles.table}>
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
            <tr>
              <td colSpan={5} className={styles.empty}>
                No SKAN postbacks yet.
              </td>
            </tr>
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
      </table>
    </div>
  );
}
