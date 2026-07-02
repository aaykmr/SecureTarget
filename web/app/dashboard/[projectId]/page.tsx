import {
  Activity01Icon,
  Analytics01Icon,
  Link01Icon,
  Megaphone01Icon,
  SettingsIcon,
} from "@hugeicons/core-free-icons";
import { isCashfreeBillingEnforced } from "@securetarget/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { DashboardPanel } from "@/components/dashboard/panel";
import { HugeIcon } from "@/components/huge-icon";
import { getDb } from "@/lib/db";
import { getBillingSubscription, getProjectForUser, listApiKeysForProject, projectHasActiveApiKey, userBillingAllowsProductUsage } from "@/lib/repos";
import { ApiKeyList } from "./api-key-list";
import { CreateApiKeyForm } from "./create-key-form";
import { IntegrationSnippets } from "./integration-snippets";
import styles from "./page.module.scss";

const QUICK_LINKS = [
  { href: "campaigns", label: "Campaigns", icon: Megaphone01Icon },
  { href: "attribution", label: "Attribution", icon: Analytics01Icon },
  { href: "links", label: "Links", icon: Link01Icon },
  { href: "events", label: "Events", icon: Activity01Icon },
  { href: "settings/apps", label: "Settings", icon: SettingsIcon },
] as const;

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }
  const db = getDb();
  const project = getProjectForUser(db, projectId, userId);
  if (!project) {
    notFound();
  }
  const keys = listApiKeysForProject(db, projectId);
  const hasActiveKey = projectHasActiveApiKey(db, projectId);
  const billingLocked = isCashfreeBillingEnforced() && !userBillingAllowsProductUsage(db, userId);
  const billing = getBillingSubscription(db, userId);

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
          <Link key={item.href} href={`/dashboard/${project.id}/${item.href}`} className={styles.quickLink}>
            <HugeIcon icon={item.icon} size={16} className={styles.quickIcon} />
            {item.label}
          </Link>
        ))}
      </nav>

      {billingLocked ? (
        <p className={styles.billingHint}>
          Cashfree billing is required. Complete an active subscription from the{" "}
          <Link href="/dashboard" className={styles.billingHintLink}>
            dashboard home
          </Link>
          {billing ? ` (current status: ${billing.status}).` : "."}
        </p>
      ) : null}

      <DashboardPanel
        title="API keys"
        lead={
          <>
            One active key per project. Use the key in the <code>x-api-key</code> header; the ingest server maps it to this
            project&apos;s <code>companyId</code>. Rotating revokes the previous key.
          </>
        }
      >
        <div className={styles.formSlot}>
          <CreateApiKeyForm projectId={project.id} disabled={billingLocked} hasActiveKey={hasActiveKey} />
        </div>
        <ApiKeyList keys={keys} projectId={project.id} />
      </DashboardPanel>

      <DashboardPanel
        title="Integration"
        lead={
          <>
            Step-by-step setup for Web, iOS, and Android. Use your API key, <code>companyId</code>, and ingest URL below.
            Set <code>NEXT_PUBLIC_INGEST_URL</code> and <code>NEXT_PUBLIC_APP_URL</code> in this app&apos;s{" "}
            <code>.env</code> so snippets match your environment.
          </>
        }
      >
        <IntegrationSnippets companyId={project.company_id} projectId={project.id} />
      </DashboardPanel>
    </div>
  );
}
