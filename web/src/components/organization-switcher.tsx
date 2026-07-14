import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { api, type Organization } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { HugeIcon } from "@/components/huge-icon";
import styles from "./organization-switcher.module.scss";

const PAGE_SIZE = 20;

export function OrganizationSwitcher() {
  const { token, currentOrganization, setCurrentOrganization } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchId = useId();
  const listId = useId();

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => window.clearTimeout(t);
  }, [query]);

  const loadPage = useCallback(
    async (pageToLoad: number, replace: boolean) => {
      if (!token) return;
      if (replace) setLoading(true);
      else setLoadingMore(true);
      try {
        const result = await api.searchOrganizations(token, {
          q: debouncedQuery || undefined,
          page: pageToLoad,
          pageSize: PAGE_SIZE,
        });
        setPage(result.page);
        setTotalPages(result.totalPages);
        setOrgs((prev) => (replace ? result.organizations : [...prev, ...result.organizations]));
      } catch {
        if (replace) setOrgs([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [token, debouncedQuery],
  );

  useEffect(() => {
    if (!open) return;
    void loadPage(1, true);
  }, [open, debouncedQuery, loadPage]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function onScrollList() {
    const el = listRef.current;
    if (!el || loadingMore || loading || page >= totalPages) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      void loadPage(page + 1, false);
    }
  }

  function selectOrg(org: Organization) {
    setCurrentOrganization(org);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <span className={styles.label}>Organization</span>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.triggerText}>
          {currentOrganization?.name ?? "Select organization"}
        </span>
        <HugeIcon icon={ArrowDown01Icon} size={16} className={styles.chevron} />
      </button>

      {open ? (
        <div className={styles.popover}>
          <label className={styles.searchLabel} htmlFor={searchId}>
            Search organizations
          </label>
          <input
            id={searchId}
            type="search"
            className={styles.search}
            placeholder="Search organizations"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div
            id={listId}
            ref={listRef}
            className={styles.list}
            role="listbox"
            onScroll={onScrollList}
          >
            {loading ? (
              <p className={styles.empty}>Loading…</p>
            ) : orgs.length === 0 ? (
              <p className={styles.empty}>No organizations found</p>
            ) : (
              orgs.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  role="option"
                  aria-selected={org.id === currentOrganization?.id}
                  className={`${styles.option} ${
                    org.id === currentOrganization?.id ? styles.optionActive : ""
                  }`}
                  onClick={() => selectOrg(org)}
                >
                  {org.name}
                </button>
              ))
            )}
            {loadingMore ? <p className={styles.empty}>Loading more…</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
