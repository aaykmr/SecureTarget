import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type SkanPostback } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { DataTable, DataTableEmpty } from "@/components/dashboard/data-table";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import styles from "./CampaignPage.module.scss";

export function SkanPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { token } = useAuth();
  const [rows, setRows] = useState<SkanPostback[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || !projectId) return;
    setLoading(true);
    try {
      const data = await api.listSkanPostbacks(token, projectId);
      setRows(data.postbacks);
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
        eyebrow="iOS privacy"
        title="SKAdNetwork postbacks"
        description={
          <p>
            Aggregate iOS privacy channel data. Post to <code>POST /v1/skan/postback</code> with your API key.
          </p>
        }
      />

      {loading ? <p>Loading…</p> : null}

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
