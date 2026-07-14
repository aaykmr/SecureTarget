import { useState } from "react";
import { api, ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { DashboardPanel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./create-project-form.module.scss";

export function CreateProjectForm({ onCreated }: { onCreated?: () => void }) {
  const { token, currentOrganization } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || !currentOrganization) return;
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    try {
      await api.createProject(token, name, currentOrganization.id);
      form.reset();
      onCreated?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create project.");
    } finally {
      setPending(false);
    }
  }

  if (!currentOrganization) {
    return (
      <DashboardPanel title="New project">
        <p className={styles.error}>
          Select an organization in the sidebar before creating a project.
        </p>
      </DashboardPanel>
    );
  }

  return (
    <DashboardPanel title="New project">
      <form onSubmit={onSubmit} className={styles.form}>
        {error ? <p className={styles.error}>{error}</p> : null}
        <p className={styles.orgHint}>
          Organization: <strong>{currentOrganization.name}</strong>
        </p>
        <Input name="name" label="Name" required placeholder="My website" />
        <Button type="submit" disabled={pending} size="sm" alignSelfStart>
          {pending ? "Creating…" : "Create project"}
        </Button>
      </form>
    </DashboardPanel>
  );
}
