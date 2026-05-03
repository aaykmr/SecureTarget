"use client";

import Close from "@mui/icons-material/Close";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "react-toastify";
import { fetchSdkEventsAction } from "@/app/dashboard/actions";
import type { SdkEventRow } from "@/lib/repos";
import styles from "./events-explorer.module.scss";

const LIST_PAYLOAD_MAX = 100;
const LIST_EVENT_LABEL_MAX = 40;

const ACTION_TYPE_OPTIONS = [
  "record",
  "login",
  "conversion",
  "custom",
] as const;

/** Conversion name or custom `eventType` from payload JSON (empty if none). */
function payloadEventLabel(payloadJson: string): string {
  try {
    const p = JSON.parse(payloadJson) as Record<string, unknown>;
    if (typeof p.conversionName === "string" && p.conversionName.trim())
      return p.conversionName.trim();
    if (typeof p.eventType === "string" && p.eventType.trim())
      return p.eventType.trim();
  } catch {
    /* invalid JSON */
  }
  return "";
}

function shortenEventLabel(json: string, max: number): string {
  const s = payloadEventLabel(json);
  if (!s) return "—";
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function eventsListPath(
  projectId: string,
  pageNum: number,
  opts: { actionType: string; eventLabel: string },
): string {
  const p = new URLSearchParams();
  if (pageNum > 1) p.set("page", String(pageNum));
  if (opts.actionType) p.set("actionType", opts.actionType);
  const ev = opts.eventLabel.trim();
  if (ev) p.set("event", ev);
  const q = p.toString();
  return q
    ? `/dashboard/${projectId}/events?${q}`
    : `/dashboard/${projectId}/events`;
}

function shortenHash(hash: string | null): string {
  if (!hash) return "—";
  return hash.length <= 14 ? hash : `${hash.slice(0, 12)}…`;
}

function shortenPayload(json: string, max: number): string {
  if (json.length <= max) return json;
  return `${json.slice(0, max)}…`;
}

/**
 * Deterministic across SSR and first client paint (fixed locale + UTC).
 * Avoid using this for user-visible final copy — prefer LocalDateTimeText.
 */
function formatUtcStable(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** SSR-safe first paint (UTC + fixed locale), then viewer locale/timezone after mount. */
function LocalDateTimeText({ iso }: { iso: string }) {
  const [text, setText] = useState(() => formatUtcStable(iso));

  useEffect(() => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      setText(iso);
      return;
    }
    setText(
      d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    );
  }, [iso]);

  return <span>{text}</span>;
}

function formatPayloadPretty(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

function CopyableDd({
  label,
  copyText,
  className,
  children,
}: {
  /** Short label for the toast, e.g. "Event id" */
  label: string;
  copyText: string;
  className?: string;
  children: React.ReactNode;
}) {
  const copy = useCallback(
    async (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(copyText);
        toast.success(`Copied ${label}`);
      } catch {
        toast.error("Could not copy");
      }
    },
    [copyText, label],
  );

  return (
    <dd
      role="button"
      tabIndex={0}
      className={clsx(styles.ddInteractive, className)}
      onClick={(e) => void copy(e)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void copy(e);
        }
      }}
    >
      {children}
    </dd>
  );
}

function EventDetailPanel({
  row,
  onClose,
}: {
  row: SdkEventRow;
  onClose: () => void;
}) {
  const detailFields: Array<{
    key: string;
    rowClassName: string;
    dt: string;
    copyLabel: string;
    copyText: string;
    ddClassName?: string;
    content: ReactNode;
  }> = useMemo(() => {
    const eventLabel = payloadEventLabel(row.payload_json) || "—";
    const prettyPayload = formatPayloadPretty(row.payload_json);
    return [
      {
        key: "id",
        rowClassName: styles.detailRow,
        dt: "Event id",
        copyLabel: "Event id",
        copyText: row.id,
        ddClassName: styles.dd,
        content: row.id,
      },
      {
        key: "timeLocal",
        rowClassName: styles.detailRow,
        dt: "Time (your timezone)",
        copyLabel: "Time (ISO)",
        copyText: row.created_at,
        ddClassName: styles.dd,
        content: <LocalDateTimeText key={row.created_at} iso={row.created_at} />,
      },
      {
        key: "storedIso",
        rowClassName: styles.detailRow,
        dt: "Stored (UTC / ISO)",
        copyLabel: "Stored (UTC / ISO)",
        copyText: row.created_at,
        ddClassName: styles.ddMuted,
        content: row.created_at,
      },
      {
        key: "actionType",
        rowClassName: styles.detailRow,
        dt: "Action type",
        copyLabel: "Action type",
        copyText: row.event_type,
        ddClassName: styles.dd,
        content: row.event_type,
      },
      {
        key: "event",
        rowClassName: styles.detailRow,
        dt: "Event",
        copyLabel: "Event",
        copyText: eventLabel,
        ddClassName: styles.dd,
        content: eventLabel,
      },
      {
        key: "companyId",
        rowClassName: styles.detailRow,
        dt: "Company id",
        copyLabel: "Company id",
        copyText: row.company_id,
        ddClassName: styles.dd,
        content: row.company_id,
      },
      {
        key: "tokenHash",
        rowClassName: styles.detailRow,
        dt: "Token hash",
        copyLabel: "Token hash",
        copyText: row.token_hash ?? "",
        ddClassName: styles.dd,
        content: row.token_hash ?? "—",
      },
      {
        key: "payload",
        rowClassName: styles.detailRowPayload,
        dt: "Payload",
        copyLabel: "Payload",
        copyText: prettyPayload,
        content: <pre className={styles.payloadPre}>{prettyPayload}</pre>,
      },
    ];
  }, [row]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <button type="button" className={styles.backdrop} aria-label="Close details" onClick={onClose} />
      <aside
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-detail-title"
      >
        <div className={styles.panelHeader}>
          <h2 id="event-detail-title" className={styles.panelTitle}>
            Event details
          </h2>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
            <Close className={styles.closeIcon} aria-hidden />
          </button>
        </div>


        <div className={styles.panelBody}>
          <dl className={styles.dl}>
            {detailFields.map((field) => (
              <div key={field.key} className={field.rowClassName}>
                <dt className={styles.dt}>{field.dt}</dt>
                <CopyableDd
                  label={field.copyLabel}
                  copyText={field.copyText}
                  className={field.ddClassName}
                >
                  {field.content}
                </CopyableDd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
    </>
  );
}

export function EventsExplorer({
  projectId,
  initialRows,
  initialTotal,
  initialPage,
  pageSize,
  initialActionType = "",
  initialEventLabel = "",
}: {
  projectId: string;
  initialRows: SdkEventRow[];
  initialTotal: number;
  initialPage: number;
  pageSize: number;
  /** Filter: `sdk_events.event_type` (ingest actionType). */
  initialActionType?: string;
  /** Filter: substring on payload `conversionName` / `eventType`. */
  initialEventLabel?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [tokenInput, setTokenInput] = useState("");
  const [appliedToken, setAppliedToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SdkEventRow | null>(null);
  const [actionTypeFilter, setActionTypeFilter] = useState(initialActionType);
  const [eventLabelFilter, setEventLabelFilter] = useState(initialEventLabel);

  useEffect(() => {
    setActionTypeFilter(initialActionType);
    setEventLabelFilter(initialEventLabel);
  }, [initialActionType, initialEventLabel]);

  useEffect(() => {
    if (appliedToken !== null) return;
    setRows(initialRows);
    setTotal(initialTotal);
    setPage(initialPage);
  }, [initialRows, initialTotal, initialPage, appliedToken]);

  useEffect(() => {
    if (selected && rows.every((r) => r.id !== selected.id)) {
      setSelected(null);
    }
  }, [rows, selected]);

  useEffect(() => {
    if (!selected) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const rangeLabel = useMemo(() => {
    if (total === 0) return "No events.";
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return `Showing ${start}–${end} of ${total}`;
  }, [total, page, pageSize]);

  type FilterSnapshot = { actionType: string; eventLabel: string };

  const load = useCallback(
    async (pageNum: number, token?: string, snapshot?: FilterSnapshot) => {
      setPending(true);
      setError(null);
      const at = (
        snapshot !== undefined ? snapshot.actionType : actionTypeFilter
      ).trim();
      const ev = (
        snapshot !== undefined ? snapshot.eventLabel : eventLabelFilter
      ).trim();
      const res = await fetchSdkEventsAction(projectId, {
        page: pageNum,
        token,
        actionType: at || undefined,
        eventLabel: ev || undefined,
      });
      setPending(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRows(res.rows);
      setTotal(res.total);
      setPage(res.page);
    },
    [projectId, actionTypeFilter, eventLabelFilter],
  );

  const filterQuery = useMemo(
    () => ({ actionType: actionTypeFilter, eventLabel: eventLabelFilter }),
    [actionTypeFilter, eventLabelFilter],
  );

  const hasActiveFilters = Boolean(actionTypeFilter || eventLabelFilter.trim());

  /** Applies session token (if any) plus action/event filters in one step. */
  const applyAllFilters = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const raw = tokenInput.trim();
      const snap = { actionType: actionTypeFilter, eventLabel: eventLabelFilter };
      if (!raw) {
        setAppliedToken(null);
        setTokenInput("");
        const path = eventsListPath(projectId, 1, snap);
        router.push(path);
        router.refresh();
        return;
      }
      setAppliedToken(raw);
      await load(1, raw, snap);
    },
    [tokenInput, actionTypeFilter, eventLabelFilter, projectId, router, load],
  );

  const clearAllFilters = useCallback(() => {
    setTokenInput("");
    setAppliedToken(null);
    setActionTypeFilter("");
    setEventLabelFilter("");
    router.push(`/dashboard/${projectId}/events`);
    router.refresh();
  }, [projectId, router]);

  const pageNumbers = useMemo(() => {
    const maxButtons = 7;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = new Set<number>(
      [1, totalPages, page, page - 1, page + 1].filter(
        (p) => p >= 1 && p <= totalPages,
      ),
    );
    const sorted = [...pages].sort((a, b) => a - b);
    const out: (number | "ellipsis")[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const n = sorted[i];
      const prev = sorted[i - 1];
      if (i > 0 && prev !== undefined && n - prev > 1) {
        out.push("ellipsis");
      }
      out.push(n);
    }
    return out;
  }, [totalPages, page]);

  return (
    <>
      <div className={styles.stack}>
        <form className={styles.filtersForm} onSubmit={applyAllFilters}>
          <div className={styles.filtersHeader}>
            <h2 className={styles.filtersHeading}>Filter events</h2>
            <p className={styles.filtersIntro}>
              Session id, action type, and event search apply together on the server. Submit with Apply or reset everything with Clear all.
            </p>
          </div>

          <div className={styles.tokenBlock}>
            <label htmlFor="token-filter" className={styles.label}>
              Session id (same opaque token as JSON <code className={styles.codeInline}>token</code> on{" "}
              <code className={styles.codeInline}>/v1/record</code>)
            </label>
            <input
              id="token-filter"
              name="token"
              type="password"
              autoComplete="off"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Optional — paste sess_… id"
              className={styles.inputPassword}
            />
          </div>

          <div className={styles.filtersDivider} aria-hidden />

          <div className={styles.grid2}>
            <div>
              <label htmlFor="action-type-filter" className={styles.label}>
                Action type
              </label>
              <select
                id="action-type-filter"
                value={actionTypeFilter}
                onChange={(e) => setActionTypeFilter(e.target.value)}
                className={styles.selectInput}
              >
                <option value="">All</option>
                {ACTION_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="event-label-filter" className={styles.label}>
                Event (payload)
              </label>
              <input
                id="event-label-filter"
                type="search"
                value={eventLabelFilter}
                onChange={(e) => setEventLabelFilter(e.target.value)}
                placeholder="Matches conversionName or eventType in JSON"
                autoComplete="off"
                className={styles.searchInput}
              />
            </div>
          </div>

          <div className={styles.filterActions}>
            <button type="submit" disabled={pending} className={styles.btnPrimarySm}>
              {pending ? "Loading…" : "Apply"}
            </button>
            <button type="button" disabled={pending} className={styles.btnGhostSm} onClick={() => clearAllFilters()}>
              Clear all
            </button>
          </div>

          <p className={styles.help}>
            Action type filters the ingest discriminant (<code>record</code>, <code>login</code>, <code>conversion</code>,{" "}
            <code>custom</code>). Event matches substring on payload fields <code>conversionName</code> and <code>eventType</code>.
          </p>
        </form>

        {error ? <p className={styles.errorBanner}>{error}</p> : null}

        <div className={styles.metaRow}>
          <p className={styles.metaText}>{rangeLabel}</p>
          <p className={styles.metaText}>
            Page {page} of {totalPages}
            {appliedToken ? " · session filter" : ""}
            {hasActiveFilters ? " · type/event filter" : ""}
          </p>
        </div>

        <p className={styles.hint}>Tap a row to open full payload and copy options.</p>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.trHead}>
                <th scope="col" className={clsx(styles.thBase, styles.thTime)}>
                  Time
                </th>
                <th scope="col" className={clsx(styles.thBase, styles.thAction)}>
                  Action type
                </th>
                <th scope="col" className={clsx(styles.thBase, styles.thEvent)}>
                  Event
                </th>
                <th scope="col" className={clsx(styles.thBase, styles.thToken)}>
                  Token
                </th>
                <th scope="col" className={clsx(styles.thBase, styles.thPayload)}>
                  Payload
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyCell}>
                    No rows match.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    className={clsx(styles.tableRow, selected?.id === r.id && styles.tableRowSelected)}
                    onClick={() => setSelected(r)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(r);
                      }
                    }}
                  >
                    <td className={styles.tdTime} title={r.created_at}>
                      <LocalDateTimeText key={r.id} iso={r.created_at} />
                    </td>
                    <td className={styles.tdMid}>
                      <span className={styles.badge}>{r.event_type}</span>
                    </td>
                    <td
                      className={styles.tdEvent}
                      title={payloadEventLabel(r.payload_json) || undefined}
                    >
                      <span className={clsx(styles.badge, styles.eventBadge)}>
                        {shortenEventLabel(r.payload_json, LIST_EVENT_LABEL_MAX)}
                      </span>
                    </td>
                    <td className={styles.tdToken} title={r.token_hash ?? ""}>
                      {shortenHash(r.token_hash)}
                    </td>
                    <td className={styles.tdPayload}>
                      <span className={styles.truncate} title={r.payload_json}>
                        {shortenPayload(r.payload_json, LIST_PAYLOAD_MAX)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <nav className={styles.pagination}>
            {!appliedToken ? (
              <>
                <div className={styles.paginationCluster}>
                  {page <= 1 ? (
                    <span className={styles.paginationDisabled}>First</span>
                  ) : (
                    <Link href={eventsListPath(projectId, 1, filterQuery)} className={styles.paginationLink} scroll={false}>
                      First
                    </Link>
                  )}
                  {page <= 1 ? (
                    <span className={styles.paginationDisabled}>Previous</span>
                  ) : (
                    <Link
                      href={eventsListPath(projectId, page - 1, filterQuery)}
                      className={styles.paginationLink}
                      scroll={false}
                    >
                      Previous
                    </Link>
                  )}
                  {page >= totalPages ? (
                    <span className={styles.paginationDisabled}>Next</span>
                  ) : (
                    <Link
                      href={eventsListPath(projectId, page + 1, filterQuery)}
                      className={styles.paginationLink}
                      scroll={false}
                    >
                      Next
                    </Link>
                  )}
                  {page >= totalPages ? (
                    <span className={styles.paginationDisabled}>Last</span>
                  ) : (
                    <Link
                      href={eventsListPath(projectId, totalPages, filterQuery)}
                      className={styles.paginationLink}
                      scroll={false}
                    >
                      Last
                    </Link>
                  )}
                </div>
                <div className={styles.paginationNums}>
                  {pageNumbers.map((item, i) =>
                    item === "ellipsis" ? (
                      <span key={`e-${i}`} className={styles.ellipsis}>
                        …
                      </span>
                    ) : item === page ? (
                      <span key={item} className={styles.pageCurrent} aria-current="page">
                        {item}
                      </span>
                    ) : (
                      <Link
                        key={item}
                        href={eventsListPath(projectId, item, filterQuery)}
                        scroll={false}
                        className={styles.pageLink}
                      >
                        {item}
                      </Link>
                    ),
                  )}
                </div>
              </>
            ) : (
              <div className={styles.paginationCluster}>
                <button
                  type="button"
                  disabled={pending || page <= 1}
                  className={pending || page <= 1 ? styles.paginationDisabled : styles.paginationLink}
                  onClick={() => void load(1, appliedToken)}
                >
                  First
                </button>
                <button
                  type="button"
                  disabled={pending || page <= 1}
                  className={pending || page <= 1 ? styles.paginationDisabled : styles.paginationLink}
                  onClick={() => void load(page - 1, appliedToken)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={pending || page >= totalPages}
                  className={pending || page >= totalPages ? styles.paginationDisabled : styles.paginationLink}
                  onClick={() => void load(page + 1, appliedToken)}
                >
                  Next
                </button>
                <button
                  type="button"
                  disabled={pending || page >= totalPages}
                  className={pending || page >= totalPages ? styles.paginationDisabled : styles.paginationLink}
                  onClick={() => void load(totalPages, appliedToken)}
                >
                  Last
                </button>
                <div className={styles.paginationNums}>
                  {pageNumbers.map((item, i) =>
                    item === "ellipsis" ? (
                      <span key={`fe-${i}`} className={styles.ellipsis}>
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        disabled={pending || item === page}
                        className={item === page ? styles.pageBtnCurrent : styles.pageBtn}
                        onClick={() => void load(item, appliedToken)}
                      >
                        {item}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
          </nav>
        ) : null}
      </div>

      {selected ? (
        <EventDetailPanel row={selected} onClose={() => setSelected(null)} />
      ) : null}
    </>
  );
}
