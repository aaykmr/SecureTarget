import { Megaphone01Icon, Analytics01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DataTable, DataTableEmpty } from "@/components/dashboard/data-table";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { HugeIcon } from "@/components/huge-icon";
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
      <DashboardPageHeader
        backHref={`/dashboard/${projectId}`}
        backLabel="Get started"
        eyebrow="Analytics"
        title="Campaign performance"
        description={
          <p>
            Installs and conversions grouped by media source and campaign from attributed install events.
          </p>
        }
      />

      <div className={styles.stats}>
        <StatCard
          label="Non-organic installs"
          value={organic.non_organic}
          icon={<HugeIcon icon={Megaphone01Icon} size={18} />}
          tone="brand"
        />
        <StatCard
          label="Organic installs"
          value={organic.organic}
          icon={<HugeIcon icon={Analytics01Icon} size={18} />}
          tone="success"
        />
      </div>

      <DataTable caption="Campaign performance by media source">
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
            <DataTableEmpty colSpan={8}>
              No attributed campaigns yet. Create a{" "}
              <Link href={`/dashboard/${projectId}/links`}>tracking link</Link> and send install events from your SDK.
            </DataTableEmpty>
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
      </DataTable>
    </div>
  );
}
