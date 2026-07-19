import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, type SdkEvent } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { DataTable, DataTableEmpty } from "@/components/dashboard/data-table";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import styles from "./EventsPage.module.scss";

function payloadLabel(payloadJson: string): string {
  try {
    const p = JSON.parse(payloadJson) as Record<string, unknown>;
    if (typeof p.conversionName === "string" && p.conversionName.trim()) return p.conversionName.trim();
    if (typeof p.eventType === "string" && p.eventType.trim()) return p.eventType.trim();
  } catch {
    /* ignore */
  }
  return "—";
}

function prettyPayload(payloadJson: string): string {
  try {
    return JSON.stringify(JSON.parse(payloadJson), null, 2);
  } catch {
    return payloadJson;
  }
}

export function EventsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<SdkEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionType, setActionType] = useState(searchParams.get("actionType") ?? "");
  const [eventLabel, setEventLabel] = useState(searchParams.get("event") ?? "");
  const [tokenFilter, setTokenFilter] = useState(searchParams.get("token") ?? "");
  const [selected, setSelected] = useState<SdkEvent | null>(null);

  const load = useCallback(async () => {
    if (!token || !projectId) return;
    setLoading(true);
    try {
      const currentPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
      const data = await api.listEvents(token, projectId, {
        page: currentPage,
        actionType: searchParams.get("actionType") ?? undefined,
        event: searchParams.get("event") ?? undefined,
        token: searchParams.get("token") ?? undefined,
      });
      setEvents(data.events);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [projectId, searchParams, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = () => {
    const next = new URLSearchParams();
    if (actionType) next.set("actionType", actionType);
    if (eventLabel.trim()) next.set("event", eventLabel.trim());
    if (tokenFilter.trim()) next.set("token", tokenFilter.trim());
    setSearchParams(next);
  };

  if (!projectId) return null;

  return (
    <div className={styles.root}>
      <DashboardPageHeader
        backHref={`/dashboard/${projectId}`}
        backLabel="Project"
        eyebrow="Ingest"
        title="Events"
        description={
          <p>
            Ingested SDK rows from <code>sdk_events</code> for this project. Filter by action type or opaque token.
          </p>
        }
      />

      <div className={styles.filters}>
        <Select
          label="Action type"
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
        >
          <option value="">All</option>
          <option value="record">record</option>
          <option value="login">login</option>
          <option value="conversion">conversion</option>
          <option value="install">install</option>
          <option value="custom">custom</option>
        </Select>
        <Input label="Event label" value={eventLabel} onChange={(e) => setEventLabel(e.target.value)} />
        <Input label="Opaque token" value={tokenFilter} onChange={(e) => setTokenFilter(e.target.value)} mono />
        <Button type="button" size="sm" onClick={applyFilters}>
          Apply filters
        </Button>
      </div>

      {loading ? <p>Loading…</p> : null}

      <p className={styles.meta}>
        {total} event{total === 1 ? "" : "s"} · page {page} of {totalPages}
      </p>

      <DataTable caption="SDK events">
        <thead>
          <tr>
            <th>Time</th>
            <th>Action</th>
            <th>Event</th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <DataTableEmpty colSpan={3}>No events match your filters.</DataTableEmpty>
          ) : (
            events.map((row) => (
              <tr
                key={row.id}
                className={styles.clickableRow}
                onClick={() => setSelected(row)}
                tabIndex={0}
                role="button"
                aria-label="View event details"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(row);
                  }
                }}
              >
                <td>{new Date(row.created_at).toLocaleString()}</td>
                <td>{row.event_type}</td>
                <td>{payloadLabel(row.payload_json)}</td>
              </tr>
            ))
          )}
        </tbody>
      </DataTable>

      <Modal title="Event details" open={selected !== null} onClose={() => setSelected(null)}>
        {selected ? (
          <div className={styles.detail}>
            <dl className={styles.detailGrid}>
              <dt>Time</dt>
              <dd>{new Date(selected.created_at).toLocaleString()}</dd>
              <dt>Action</dt>
              <dd>{selected.event_type}</dd>
              <dt>Event</dt>
              <dd>{payloadLabel(selected.payload_json)}</dd>
            </dl>
            <p className={styles.detailLabel}>Payload</p>
            <pre className={styles.payload}>{prettyPayload(selected.payload_json)}</pre>
          </div>
        ) : null}
      </Modal>

      <div className={styles.pagination}>
        {page > 1 ? (
          <Link
            to={`/dashboard/${projectId}/events?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(page - 1) }).toString()}`}
          >
            Previous
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link
            to={`/dashboard/${projectId}/events?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(page + 1) }).toString()}`}
          >
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}
