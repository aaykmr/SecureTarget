import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  AddCircleIcon,
  Building03Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { api, ApiError, type WaitlistInquiry } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { DataTable, DataTableEmpty } from "@/components/dashboard/data-table";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { DashboardPanel } from "@/components/dashboard/panel";
import { HugeIcon } from "@/components/huge-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./InquiriesPage.module.scss";

type StatusFilter = "all" | "open" | "converted" | "disabled";

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function CopyableValue({
  value,
  href,
  label,
}: {
  value: string;
  href?: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    const ok = await copyText(value);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={styles.copyRow}>
      {href ? (
        <a href={href} className={styles.copyValue}>
          {value}
        </a>
      ) : (
        <span className={styles.copyValue}>{value}</span>
      )}
      <button
        type="button"
        className={styles.copyBtn}
        onClick={() => void onCopy()}
        title={copied ? "Copied" : `Copy ${label}`}
        aria-label={copied ? "Copied" : `Copy ${label}`}
      >
        <HugeIcon icon={copied ? Tick02Icon : Copy01Icon} size={14} />
      </button>
    </div>
  );
}

export function InquiriesPage() {
  const { token, isGlobalAdmin, refreshMe } = useAuth();
  const [inquiries, setInquiries] = useState<WaitlistInquiry[]>([]);
  const [q, setQ] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.listWaitlist(token, {
        q: qApplied || undefined,
        page,
        pageSize: 20,
        status,
      });
      setInquiries(result.inquiries);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setPage(result.page);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load inquiries.");
    } finally {
      setLoading(false);
    }
  }, [token, qApplied, page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isGlobalAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  async function createOrg(inquiry: WaitlistInquiry) {
    if (!token) return;
    setBusyId(inquiry.id);
    setError(null);
    try {
      await api.createOrganizationFromInquiry(token, inquiry.id);
      await refreshMe();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create organization.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleDisabled(inquiry: WaitlistInquiry) {
    if (!token) return;
    setBusyId(inquiry.id);
    setError(null);
    try {
      await api.setWaitlistDisabled(token, inquiry.id, !inquiry.disabled_at);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update inquiry.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={styles.root}>
      <DashboardPageHeader
        eyebrow="Admin"
        title="Inquiries"
        description={<p>Homepage waitlist submissions. Create an organization or contact the requester.</p>}
      />

      <DashboardPanel title="Filters">
        <form
          className={styles.filters}
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQApplied(q.trim());
          }}
        >
          <Input
            name="q"
            label="Search"
            placeholder="Name, email, phone, org, message"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label className={styles.selectLabel}>
            <span>Status</span>
            <select
              className={styles.select}
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value as StatusFilter);
              }}
            >
              <option value="all">All</option>
              <option value="open">Open (no org yet)</option>
              <option value="converted">Converted</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <Button type="submit" size="sm">
            Apply
          </Button>
        </form>
      </DashboardPanel>

      <DashboardPanel title={`Results (${total})`}>
        {error ? <p className={styles.error}>{error}</p> : null}
        <DataTable>
          <thead>
            <tr>
              <th>Submitted</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Organization</th>
              <th>Message</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <DataTableEmpty colSpan={7}>Loading…</DataTableEmpty>
            ) : inquiries.length === 0 ? (
              <DataTableEmpty colSpan={7}>No inquiries match these filters.</DataTableEmpty>
            ) : (
              inquiries.map((row) => {
                const disabled = Boolean(row.disabled_at);
                return (
                  <tr key={row.id} className={disabled ? styles.rowDisabled : undefined}>
                    <td className={styles.nowrap}>
                      {new Date(row.created_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {disabled ? <span className={styles.badge}>Disabled</span> : null}
                    </td>
                    <td>
                      <span className={styles.strong}>{row.name}</span>
                    </td>
                    <td>
                      <CopyableValue
                        label="email"
                        value={row.email}
                        href={`mailto:${encodeURIComponent(row.email)}`}
                      />
                    </td>
                    <td>
                      {row.phone ? (
                        <CopyableValue
                          label="phone"
                          value={row.phone}
                          href={`tel:${row.phone.replace(/[^\d+]/g, "")}`}
                        />
                      ) : (
                        <span className={styles.muted}>—</span>
                      )}
                    </td>
                    <td>{row.organization}</td>
                    <td className={styles.message}>{row.message || "—"}</td>
                    <td>
                      <div className={styles.actions}>
                        {row.created_organization_id ? (
                          <span className={styles.tooltipWrap} data-tooltip="View organizations">
                            <Link
                              className={styles.iconBtn}
                              to="/dashboard/organizations"
                              aria-label="View organizations"
                            >
                              <HugeIcon icon={Building03Icon} size={20} />
                            </Link>
                          </span>
                        ) : (
                          <span className={styles.tooltipWrap} data-tooltip="Create organization">
                            <button
                              type="button"
                              className={styles.iconBtn}
                              disabled={disabled || busyId === row.id}
                              onClick={() => void createOrg(row)}
                              aria-label="Create organization"
                            >
                              <HugeIcon icon={AddCircleIcon} size={20} />
                            </button>
                          </span>
                        )}
                        <span
                          className={styles.tooltipWrap}
                          data-tooltip={disabled ? "Enable inquiry" : "Disable inquiry"}
                        >
                          <button
                            type="button"
                            className={styles.iconBtn}
                            disabled={busyId === row.id}
                            onClick={() => void toggleDisabled(row)}
                            aria-label={disabled ? "Enable inquiry" : "Disable inquiry"}
                          >
                            <HugeIcon
                              icon={disabled ? CheckmarkCircle02Icon : CancelCircleIcon}
                              size={20}
                            />
                          </button>
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </DataTable>

        <div className={styles.pager}>
          <Button type="button" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className={styles.pageMeta}>
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </DashboardPanel>
    </div>
  );
}
