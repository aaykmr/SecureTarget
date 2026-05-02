"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchSdkEventsAction } from "@/app/dashboard/actions";
import type { SdkEventRow } from "@/lib/repos";

const LIST_PAYLOAD_MAX = 100;

function shortenHash(hash: string | null): string {
  if (!hash) return "—";
  return hash.length <= 14 ? hash : `${hash.slice(0, 12)}…`;
}

function shortenPayload(json: string, max: number): string {
  if (json.length <= max) return json;
  return `${json.slice(0, max)}…`;
}

/** Renders stored ISO time in the viewer's local timezone. */
function formatLocalDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatPayloadPretty(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

function pageHref(projectId: string, p: number): string {
  return p <= 1 ? `/dashboard/${projectId}/events` : `/dashboard/${projectId}/events?page=${p}`;
}

function CopyButton({
  label,
  text,
  toastLabel,
  onCopied
}: {
  label: string;
  text: string;
  /** Short phrase for the toast, e.g. "Payload" */
  toastLabel: string;
  onCopied: (toast: string) => void;
}) {
  return (
    <button
      type="button"
      className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          onCopied(`Copied ${toastLabel}`);
        } catch {
          onCopied("Could not copy");
        }
      }}
    >
      {label}
    </button>
  );
}

function EventDetailPanel({
  row,
  onClose,
  onCopied
}: {
  row: SdkEventRow;
  onClose: () => void;
  onCopied: (msg: string) => void;
}) {
  const fullJson = useMemo(
    () =>
      JSON.stringify(
        {
          id: row.id,
          company_id: row.company_id,
          event_type: row.event_type,
          token_hash: row.token_hash,
          created_at: row.created_at,
          payload: (() => {
            try {
              return JSON.parse(row.payload_json) as unknown;
            } catch {
              return row.payload_json;
            }
          })()
        },
        null,
        2
      ),
    [row]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default bg-black/40 dark:bg-black/60"
        aria-label="Close details"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-detail-title"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 id="event-detail-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Event details
          </h2>
          <button
            type="button"
            className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            onClick={onClose}
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <CopyButton label="Copy row JSON" toastLabel="full row" text={fullJson} onCopied={onCopied} />
          <CopyButton label="Copy payload" toastLabel="payload" text={formatPayloadPretty(row.payload_json)} onCopied={onCopied} />
          <CopyButton label="Copy event id" toastLabel="event id" text={row.id} onCopied={onCopied} />
          {row.token_hash ? (
            <CopyButton label="Copy token hash" toastLabel="token hash" text={row.token_hash} onCopied={onCopied} />
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Event id</dt>
              <dd className="mt-0.5 break-all font-mono text-xs text-zinc-900 dark:text-zinc-100">{row.id}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Time (your timezone)</dt>
              <dd className="mt-0.5 font-mono text-xs text-zinc-900 dark:text-zinc-100">{formatLocalDateTime(row.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Stored (UTC / ISO)</dt>
              <dd className="mt-0.5 break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">{row.created_at}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Type</dt>
              <dd className="mt-0.5 font-mono text-xs text-zinc-900 dark:text-zinc-100">{row.event_type}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Company id</dt>
              <dd className="mt-0.5 break-all font-mono text-xs text-zinc-900 dark:text-zinc-100">{row.company_id}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Token hash</dt>
              <dd className="mt-0.5 break-all font-mono text-xs text-zinc-900 dark:text-zinc-100">{row.token_hash ?? "—"}</dd>
            </div>
            <div>
              <dt className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Payload</dt>
              <dd>
                <pre className="max-h-[40vh] overflow-auto rounded-md bg-zinc-100 p-3 font-mono text-xs text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
                  {formatPayloadPretty(row.payload_json)}
                </pre>
              </dd>
            </div>
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
  pageSize
}: {
  projectId: string;
  initialRows: SdkEventRow[];
  initialTotal: number;
  initialPage: number;
  pageSize: number;
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
  const [copyToast, setCopyToast] = useState<string | null>(null);

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

  const load = useCallback(
    async (pageNum: number, token?: string) => {
      setPending(true);
      setError(null);
      const res = await fetchSdkEventsAction(projectId, { page: pageNum, token });
      setPending(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRows(res.rows);
      setTotal(res.total);
      setPage(res.page);
    },
    [projectId]
  );

  const pageNumbers = useMemo(() => {
    const maxButtons = 7;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = new Set<number>([1, totalPages, page, page - 1, page + 1].filter((p) => p >= 1 && p <= totalPages));
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

  const linkBtn =
    "rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-900";
  const disabledBtn = "pointer-events-none opacity-40";

  return (
    <>
      <div className="mt-6 flex flex-col gap-4">
        <form
          className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            const raw = tokenInput.trim();
            if (!raw) {
              setAppliedToken(null);
              setTokenInput("");
              router.push(pageHref(projectId, 1));
              router.refresh();
              return;
            }
            setAppliedToken(raw);
            await load(1, raw);
          }}
        >
          <div className="min-w-0 flex-1">
            <label htmlFor="token-filter" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Filter by session id (same as JSON token on /v1/record)
            </label>
            <input
              id="token-filter"
              name="token"
              type="password"
              autoComplete="off"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Optional — paste sess_… id (same as token field)"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {pending ? "Loading…" : "Apply"}
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
              onClick={() => {
                setTokenInput("");
                setAppliedToken(null);
                setPage(1);
                router.push(pageHref(projectId, 1));
                router.refresh();
              }}
            >
              Clear
            </button>
          </div>
        </form>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{rangeLabel}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Page {page} of {totalPages}
            {appliedToken ? " · filtered" : ""}
          </p>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">Tap a row to open full payload and copy options.</p>

        <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-zinc-200 px-3 dark:border-zinc-800 sm:px-4">
          <table className="w-full min-w-[36rem] border-separate border-spacing-x-3 border-spacing-y-0 text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                <th
                  scope="col"
                  className="whitespace-nowrap border-b border-zinc-200 py-3 pr-1 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
                >
                  Time
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap border-b border-zinc-200 px-1 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
                >
                  Type
                </th>
                <th
                  scope="col"
                  className="hidden whitespace-nowrap border-b border-zinc-200 px-1 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 sm:table-cell"
                >
                  Token
                </th>
                <th
                  scope="col"
                  className="min-w-0 border-b border-zinc-200 py-3 pl-1 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
                >
                  Payload
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-zinc-500 dark:text-zinc-400">
                    No rows match.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    className={`cursor-pointer border-b border-zinc-100 transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/80 ${
                      selected?.id === r.id ? "bg-zinc-100 dark:bg-zinc-900" : ""
                    }`}
                    onClick={() => setSelected(r)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(r);
                      }
                    }}
                  >
                    <td className="align-middle whitespace-nowrap py-3 pr-1 text-xs text-zinc-600 dark:text-zinc-400" title={r.created_at}>
                      {formatLocalDateTime(r.created_at)}
                    </td>
                    <td className="align-middle whitespace-nowrap px-1 py-3">
                      <span className="inline-flex rounded-md bg-zinc-200 px-2 py-0.5 font-mono text-[11px] text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                        {r.event_type}
                      </span>
                    </td>
                    <td className="hidden max-w-[8rem] align-middle px-1 py-3 font-mono text-[11px] text-zinc-500 sm:table-cell sm:truncate" title={r.token_hash ?? ""}>
                      {shortenHash(r.token_hash)}
                    </td>
                    <td className="min-w-0 max-w-0 align-middle py-3 pl-1 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                      <span className="block truncate" title={r.payload_json}>
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
          <nav className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
            {!appliedToken ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {page <= 1 ? (
                    <span className={`${linkBtn} ${disabledBtn}`}>First</span>
                  ) : (
                    <Link href={pageHref(projectId, 1)} className={linkBtn} scroll={false}>
                      First
                    </Link>
                  )}
                  {page <= 1 ? (
                    <span className={`${linkBtn} ${disabledBtn}`}>Previous</span>
                  ) : (
                    <Link href={pageHref(projectId, page - 1)} className={linkBtn} scroll={false}>
                      Previous
                    </Link>
                  )}
                  {page >= totalPages ? (
                    <span className={`${linkBtn} ${disabledBtn}`}>Next</span>
                  ) : (
                    <Link href={pageHref(projectId, page + 1)} className={linkBtn} scroll={false}>
                      Next
                    </Link>
                  )}
                  {page >= totalPages ? (
                    <span className={`${linkBtn} ${disabledBtn}`}>Last</span>
                  ) : (
                    <Link href={pageHref(projectId, totalPages)} className={linkBtn} scroll={false}>
                      Last
                    </Link>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {pageNumbers.map((item, i) =>
                    item === "ellipsis" ? (
                      <span key={`e-${i}`} className="px-2 text-zinc-400">
                        …
                      </span>
                    ) : item === page ? (
                      <span
                        key={item}
                        className="min-w-[2.25rem] rounded-md bg-zinc-900 px-2 py-1.5 text-center text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                        aria-current="page"
                      >
                        {item}
                      </span>
                    ) : (
                      <Link
                        key={item}
                        href={pageHref(projectId, item)}
                        scroll={false}
                        className="min-w-[2.25rem] rounded-md border border-zinc-200 px-2 py-1.5 text-center text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      >
                        {item}
                      </Link>
                    )
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={pending || page <= 1}
                  className={`${linkBtn} ${pending || page <= 1 ? disabledBtn : ""}`}
                  onClick={() => void load(1, appliedToken)}
                >
                  First
                </button>
                <button
                  type="button"
                  disabled={pending || page <= 1}
                  className={`${linkBtn} ${pending || page <= 1 ? disabledBtn : ""}`}
                  onClick={() => void load(page - 1, appliedToken)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={pending || page >= totalPages}
                  className={`${linkBtn} ${pending || page >= totalPages ? disabledBtn : ""}`}
                  onClick={() => void load(page + 1, appliedToken)}
                >
                  Next
                </button>
                <button
                  type="button"
                  disabled={pending || page >= totalPages}
                  className={`${linkBtn} ${pending || page >= totalPages ? disabledBtn : ""}`}
                  onClick={() => void load(totalPages, appliedToken)}
                >
                  Last
                </button>
                <div className="flex flex-wrap gap-1">
                  {pageNumbers.map((item, i) =>
                    item === "ellipsis" ? (
                      <span key={`fe-${i}`} className="px-2 text-zinc-400">
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        disabled={pending || item === page}
                        className={`min-w-[2.25rem] rounded-md px-2 py-1.5 text-center text-sm ${
                          item === page
                            ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                            : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                        }`}
                        onClick={() => void load(item, appliedToken)}
                      >
                        {item}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </nav>
        ) : null}
      </div>

      {copyToast ? (
        <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-md bg-zinc-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
          {copyToast}
        </div>
      ) : null}

      {selected ? (
        <EventDetailPanel
          row={selected}
          onClose={() => setSelected(null)}
          onCopied={(msg) => {
            setCopyToast(msg);
            setTimeout(() => setCopyToast(null), 2000);
          }}
        />
      ) : null}
    </>
  );
}
