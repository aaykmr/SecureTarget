import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, type SdkEvent } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { DataTable, DataTableEmpty } from "@/components/dashboard/data-table";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import styles from "./EventsPage.module.scss";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 50;

function payloadLabel(payloadJson: string): string {
  try {
    const p = JSON.parse(payloadJson) as Record<string, unknown>;
    if (typeof p.conversionName === "string" && p.conversionName.trim()) return p.conversionName.trim();
    if (typeof p.eventName === "string" && p.eventName.trim()) return p.eventName.trim();
    if (typeof p.eventType === "string" && p.eventType.trim()) return p.eventType.trim();
    const meta = p.metadata;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      const m = meta as Record<string, unknown>;
      if (typeof m.eventName === "string" && m.eventName.trim()) return m.eventName.trim();
    }
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

function parsePageSize(raw: string | null): number {
  const n = parseInt(raw ?? String(DEFAULT_PAGE_SIZE), 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_PAGE_SIZE;
  if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return n;
  return Math.min(100, Math.max(1, n));
}

export function EventsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<SdkEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionType, setActionType] = useState(searchParams.get("actionType") ?? "");
  const [eventLabel, setEventLabel] = useState(searchParams.get("event") ?? "");
  const [tokenFilter, setTokenFilter] = useState(searchParams.get("token") ?? "");
  const [pageInput, setPageInput] = useState("1");
  const [selected, setSelected] = useState<SdkEvent | null>(null);

  const load = useCallback(async () => {
    if (!token || !projectId) return;
    setLoading(true);
    try {
      const currentPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
      const currentPageSize = parsePageSize(searchParams.get("pageSize"));
      const data = await api.listEvents(token, projectId, {
        page: currentPage,
        pageSize: currentPageSize,
        actionType: searchParams.get("actionType") ?? undefined,
        event: searchParams.get("event") ?? undefined,
        token: searchParams.get("token") ?? undefined,
      });
      setEvents(data.events);
      setTotal(data.total);
      setPage(data.page);
      setPageSize(data.pageSize);
      setTotalPages(data.totalPages);
      setPageInput(String(data.page));
    } finally {
      setLoading(false);
    }
  }, [projectId, searchParams, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next);
  };

  const applyFilters = () => {
    const next = new URLSearchParams();
    if (actionType) next.set("actionType", actionType);
    if (eventLabel.trim()) next.set("event", eventLabel.trim());
    if (tokenFilter.trim()) next.set("token", tokenFilter.trim());
    const size = parsePageSize(searchParams.get("pageSize"));
    if (size !== DEFAULT_PAGE_SIZE) next.set("pageSize", String(size));
    setSearchParams(next);
  };

  const goToPage = (nextPage: number) => {
    const clamped = Math.min(Math.max(1, nextPage), totalPages);
    updateParams({
      page: clamped <= 1 ? null : String(clamped),
    });
  };

  const onPageSizeChange = (value: string) => {
    const size = parsePageSize(value);
    updateParams({
      pageSize: size === DEFAULT_PAGE_SIZE ? null : String(size),
      page: null,
    });
  };

  const onPageInputSubmit = (e: FormEvent) => {
    e.preventDefault();
    const n = parseInt(pageInput, 10);
    if (!Number.isFinite(n)) {
      setPageInput(String(page));
      return;
    }
    goToPage(n);
  };

  if (!projectId) return null;

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  const pagination = (placement: "top" | "bottom") => (
    <div className={styles.paginationBlock} aria-label={`Table pagination (${placement})`}>
      <div className={styles.toolbar}>
        <p className={styles.meta}>
          {total === 0
            ? "0 events"
            : `Showing ${rangeStart}–${rangeEnd} of ${total} event${total === 1 ? "" : "s"}`}
        </p>
        <Select label="Rows per page" value={String(pageSize)} onChange={(e) => onPageSizeChange(e.target.value)}>
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </div>
      <div className={styles.pagination}>
        <div className={styles.pagerButtons}>
          <Button type="button" size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => goToPage(1)}>
            First
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={page <= 1 || loading}
            onClick={() => goToPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={page >= totalPages || loading}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={page >= totalPages || loading}
            onClick={() => goToPage(totalPages)}
          >
            Last
          </Button>
        </div>
        <form className={styles.pageJump} onSubmit={onPageInputSubmit}>
          <span className={styles.pageMeta}>
            Page {page} of {totalPages}
          </span>
          <Input
            label="Go to page"
            type="number"
            min={1}
            max={totalPages}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            disabled={loading || totalPages <= 1}
          />
          <Button type="submit" size="sm" disabled={loading || totalPages <= 1}>
            Go
          </Button>
        </form>
      </div>
    </div>
  );

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
        <Select label="Action type" value={actionType} onChange={(e) => setActionType(e.target.value)}>
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

      {pagination("top")}

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

      {pagination("bottom")}

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
    </div>
  );
}
