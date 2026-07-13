import { Megaphone01Icon, Analytics01Icon } from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type CampaignSummaryRow } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { DataTable, DataTableEmpty } from "@/components/dashboard/data-table";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { HugeIcon } from "@/components/huge-icon";
import styles from "./CampaignPage.module.scss";

export function CampaignsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { token } = useAuth();
  const [summary, setSummary] = useState<CampaignSummaryRow[]>([]);
  const [organic, setOrganic] = useState({ organic: 0, non_organic: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || !projectId) return;
    setLoading(true);
    try {
      const data = await api.getCampaignSummary(token, projectId);
      setSummary(data.summary);
      setOrganic(data.organic);
    } finally {
      setLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!projectId) return null;

  return (
    <div className={styles.root}>
      <DashboardPageHeader
        backHref={`/dashboard/${projectId}`}
        backLabel="Project"
        eyebrow="Analytics"
        title="Campaign performance"
        description={
          <p>Installs and conversions grouped by media source and campaign from attributed install events.</p>
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

      {loading ? <p>Loading…</p> : null}

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
              <Link to={`/dashboard/${projectId}/links`}>tracking link</Link> and send install events from your SDK.
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
                <td>{Number(row.revenue).toFixed(2)}</td>
                <td>{Number(row.cost).toFixed(2)}</td>
              </tr>
            ))
          )}
        </tbody>
      </DataTable>
    </div>
  );
}
