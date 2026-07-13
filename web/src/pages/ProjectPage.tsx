import {
  Activity01Icon,
  Analytics01Icon,
  Link01Icon,
  Megaphone01Icon,
  SettingsIcon,
} from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ApiKey, type Project } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { ApiKeyList } from "@/components/dashboard/api-key-list";
import { CreateApiKeyForm } from "@/components/dashboard/create-key-form";
import { IntegrationSnippets } from "@/components/dashboard/integration-snippets";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { DashboardPanel } from "@/components/dashboard/panel";
import { HugeIcon } from "@/components/huge-icon";
import styles from "./ProjectPage.module.scss";

const QUICK_LINKS = [
  { href: "campaigns", label: "Campaigns", icon: Megaphone01Icon },
  { href: "attribution", label: "Attribution", icon: Analytics01Icon },
  { href: "links", label: "Links", icon: Link01Icon },
  { href: "events", label: "Events", icon: Activity01Icon },
  { href: "settings/apps", label: "Settings", icon: SettingsIcon },
] as const;

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { token } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!token || !projectId) return;
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
      setNotFound(false);
    }
    try {
      const [{ project: p }, { apiKeys }] = await Promise.all([
        api.getProject(token, projectId),
        api.listApiKeys(token, projectId),
      ]);
      setProject(p);
      setKeys(apiKeys);
    } catch {
      if (!silent) {
        setNotFound(true);
        setProject(null);
        setKeys([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [token, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className={styles.loading}>Loading…</p>;
  }

  if (notFound || !project || !projectId) {
    return (
      <div className={styles.root}>
        <p>Project not found.</p>
        <Link to="/dashboard">Back to projects</Link>
      </div>
    );
  }

  const hasActiveKey = keys.some((k) => !k.revoked_at);

  return (
    <div className={styles.root}>
      <DashboardPageHeader
        backHref="/dashboard"
        backLabel="Projects"
        eyebrow="Get started"
        title={project.name}
        description={<p className={styles.companyLine}>companyId: {project.company_id}</p>}
      />

      <nav className={styles.quickNav} aria-label="Project sections">
        {QUICK_LINKS.map((item) => (
          <Link key={item.href} to={`/dashboard/${project.id}/${item.href}`} className={styles.quickLink}>
            <HugeIcon icon={item.icon} size={16} className={styles.quickIcon} />
            {item.label}
          </Link>
        ))}
      </nav>

      <DashboardPanel
        title="API keys"
        lead={
          <>
            One active key per project. Use the key in the <code>x-api-key</code> header; the ingest server maps it to
            this project&apos;s <code>companyId</code>. Rotating revokes the previous key.
          </>
        }
      >
        <div className={styles.formSlot}>
          <CreateApiKeyForm
            projectId={project.id}
            hasActiveKey={hasActiveKey}
            onChanged={() => void load({ silent: true })}
          />
        </div>
        <ApiKeyList keys={keys} projectId={project.id} onRevoked={() => void load({ silent: true })} />
      </DashboardPanel>

      <DashboardPanel
        title="Integration"
        lead={
          <>
            Step-by-step setup for Web, iOS, and Android. Use your API key, <code>companyId</code>, and ingest URL
            below. Set <code>VITE_INGEST_URL</code> and <code>VITE_APP_URL</code> at build time so snippets match your
            environment.
          </>
        }
      >
        <IntegrationSnippets companyId={project.company_id} projectId={project.id} />
      </DashboardPanel>
    </div>
  );
}
