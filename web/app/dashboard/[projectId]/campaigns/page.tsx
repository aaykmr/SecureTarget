import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { campaignSummary, getProjectForUser, organicVsNonOrganic } from "@/lib/repos";
import styles from "./page.module.scss";

export default async function CampaignsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const db = getDb();
  const project = getProjectForUser(db, projectId, userId);
  if (!project) notFound();

  const summary = campaignSummary(db, project.company_id);
  const organic = organicVsNonOrganic(db, project.company_id);

  return (
    <div className={styles.root}>
      <Link href={`/dashboard/${projectId}`} className={styles.backLink}>
        ← Back to project
      </Link>
      <h1 className={styles.title}>Campaign performance</h1>
      <p className={styles.lead}>
        Installs and conversions grouped by media source and campaign (from attributed install events).
      </p>

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Non-organic installs</span>
          <span className={styles.statValue}>{organic.non_organic}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Organic installs</span>
          <span className={styles.statValue}>{organic.organic}</span>
        </div>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Media source</th>
            <th>Campaign</th>
            <th>Ad group</th>
            <th>Creative</th>
            <th>Installs</th>
            <th>Conversions</th>
            <th>Revenue</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          {summary.length === 0 ? (
            <tr>
              <td colSpan={8} className={styles.empty}>
                No attributed campaigns yet. Create a{" "}
                <Link href={`/dashboard/${projectId}/links`}>tracking link</Link> and send install events from your SDK.
              </td>
            </tr>
          ) : (
            summary.map((row, i) => (
              <tr key={i}>
                <td>{row.media_source ?? "—"}</td>
                <td>{row.campaign_id ?? "—"}</td>
                <td>{row.adgroup_id ?? "—"}</td>
                <td>{row.creative_id ?? "—"}</td>
                <td>{row.installs}</td>
                <td>{row.conversions}</td>
                <td>{row.revenue.toFixed(2)}</td>
                <td>{row.cost.toFixed(2)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
