import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import styles from "./organization-switcher.module.scss";

export function CreateProjectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { token, currentOrganization, refreshProjects, setCurrentProject } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || !currentOrganization) return;
    setPending(true);
    setError(null);
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    try {
      const { project } = await api.createProject(token, name, currentOrganization.id);
      form.reset();
      onClose();
      await refreshProjects();
      setCurrentProject(project);
      navigate(`/dashboard/${project.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create project.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title="New project" open={open} onClose={onClose}>
      <form onSubmit={onCreate} className={styles.modalForm}>
        {error ? <p className={styles.formError}>{error}</p> : null}
        {currentOrganization ? (
          <p className={styles.empty} style={{ paddingTop: 0 }}>
            Organization: <strong>{currentOrganization.name}</strong>
          </p>
        ) : null}
        <Input name="name" label="Name" required placeholder="My app" />
        <Button type="submit" disabled={pending || !currentOrganization} size="sm" fullWidth>
          {pending ? "Creating…" : "Create project"}
        </Button>
      </form>
    </Modal>
  );
}
