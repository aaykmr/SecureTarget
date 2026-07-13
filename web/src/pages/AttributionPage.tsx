import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type InstallAttribution } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { DataTable, DataTableEmpty } from "@/components/dashboard/data-table";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import styles from "./CampaignPage.module.scss";

export function AttributionPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { token } = useAuth();
  const [rows, setRows] = useState<InstallAttribution[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || !projectId) return;
    setLoading(true);
    try {
      const data = await api.listInstallAttributions(token, projectId);
      setRows(data.installs);
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
        eyebrow="Attribution"
        title="Install attribution log"
        description={<p>Per-install outcomes with match rule and confidence score.</p>}
      />

      {loading ? <p>Loading…</p> : null}

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
