import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, ApiError, type Organization } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { DashboardPanel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./OrganizationsPage.module.scss";

export function OrganizationsPage() {
  const { token, isGlobalAdmin, refreshMe } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const { organizations } = await api.listOrganizations(token);
      setOrgs(organizations);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load organizations.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isGlobalAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setPending(true);
    setError(null);
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    try {
      await api.createOrganization(token, name);
      form.reset();
      await load();
      await refreshMe();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create organization.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.root}>
      <DashboardPageHeader
        eyebrow="Admin"
        title="Organizations"
        description={<p>Create organizations, then invite members from the Users page.</p>}
      />

      <DashboardPanel title="New organization">
        <form onSubmit={onCreate} className={styles.form}>
          {error ? <p className={styles.error}>{error}</p> : null}
          <Input name="name" label="Name" required placeholder="Acme Inc" />
          <Button type="submit" disabled={pending} size="sm" alignSelfStart>
            {pending ? "Creating…" : "Create organization"}
          </Button>
        </form>
      </DashboardPanel>

      <DashboardPanel title="All organizations">
        {loading ? (
          <p className={styles.empty}>Loading…</p>
        ) : orgs.length === 0 ? (
          <p className={styles.empty}>No organizations yet.</p>
        ) : (
          <ul className={styles.list}>
            {orgs.map((o) => (
              <li key={o.id} className={styles.row}>
                <span className={styles.name}>{o.name}</span>
                <span className={styles.meta}>{o.id}</span>
              </li>
            ))}
          </ul>
        )}
      </DashboardPanel>
    </div>
  );
}
