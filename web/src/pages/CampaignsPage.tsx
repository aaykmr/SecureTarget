import { Megaphone01Icon, Analytics01Icon, Link01Icon, Activity01Icon } from "@hugeicons/core-free-icons";
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
  const [organic, setOrganic] = useState({
    organic: 0,
    non_organic: 0,
    clicks: 0,
    impressions: 0,
    cta_installs: 0,
    vta_installs: 0,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || !projectId) return;
    setLoading(true);
    try {
      const data = await api.getCampaignSummary(token, projectId);
      setSummary(data.summary);
      setOrganic({
        organic: data.organic.organic ?? 0,
        non_organic: data.organic.non_organic ?? 0,
        clicks: data.organic.clicks ?? 0,
        impressions: data.organic.impressions ?? 0,
        cta_installs: data.organic.cta_installs ?? 0,
        vta_installs: data.organic.vta_installs ?? 0,
      });
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
          <p>
            Clicks, impressions, CTA/VTA installs and revenue across web and app channels, with AppsFlyer-style
            metrics (CVR, eCPI, ARPU).
          </p>
        }
      />

      <div className={styles.stats}>
        <StatCard
          label="Clicks"
          value={organic.clicks}
          icon={<HugeIcon icon={Link01Icon} size={18} />}
          tone="brand"
        />
        <StatCard
          label="Impressions"
          value={organic.impressions}
          icon={<HugeIcon icon={Activity01Icon} size={18} />}
          tone="brand"
        />
        <StatCard
          label="CTA installs"
          value={organic.cta_installs}
          icon={<HugeIcon icon={Megaphone01Icon} size={18} />}
          tone="brand"
        />
        <StatCard
          label="VTA installs"
          value={organic.vta_installs}
          icon={<HugeIcon icon={Analytics01Icon} size={18} />}
          tone="success"
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
            <th>Link type</th>
            <th>Channel</th>
            <th>Campaign</th>
            <th>Ad group</th>
            <th>Creative</th>
            <th>Clicks</th>
            <th>Impressions</th>
            <th>Installs</th>
            <th>CTA</th>
            <th>VTA</th>
            <th>CVR</th>
            <th>Conversions</th>
            <th>Revenue</th>
            <th>Cost</th>
            <th>eCPI</th>
            <th>ARPU</th>
          </tr>
        </thead>
        <tbody>
          {summary.length === 0 ? (
            <DataTableEmpty colSpan={17}>
              No campaign activity yet. Create a{" "}
              <Link to={`/dashboard/${projectId}/links`}>tracking link</Link> and drive clicks or impressions.
            </DataTableEmpty>
          ) : (
            summary.map((row, i) => {
              const cvr = row.clicks > 0 ? (row.installs / row.clicks) * 100 : null;
              const ecpi = row.installs > 0 ? row.cost / row.installs : null;
              const arpu = row.installs > 0 ? row.revenue / row.installs : null;
              return (
                <tr key={i}>
                  <td>{row.media_source ?? "—"}</td>
                  <td>{row.link_type ?? "—"}</td>
                  <td>{row.channel ?? "—"}</td>
                  <td>{row.campaign_id ?? "—"}</td>
                  <td>{row.adgroup_id ?? "—"}</td>
                  <td>{row.creative_id ?? "—"}</td>
                  <td>{row.clicks}</td>
                  <td>{row.impressions}</td>
                  <td>{row.installs}</td>
                  <td>{row.cta_installs}</td>
                  <td>{row.vta_installs}</td>
                  <td>{cvr === null ? "—" : `${cvr.toFixed(1)}%`}</td>
                  <td>{row.conversions}</td>
                  <td>{Number(row.revenue).toFixed(2)}</td>
                  <td>{Number(row.cost).toFixed(2)}</td>
                  <td>{ecpi === null ? "—" : ecpi.toFixed(2)}</td>
                  <td>{arpu === null ? "—" : arpu.toFixed(2)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </DataTable>
    </div>
  );
}
