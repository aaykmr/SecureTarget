import { isCashfreeBillingEnforced, isCashfreeSubscriptionStatusActive } from "@securetarget/shared";
import Link from "next/link";
import { auth } from "@/auth";
import { CashfreeSubscribeButton } from "@/components/cashfree-subscribe-button";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { DashboardPanel } from "@/components/dashboard/panel";
import { getDb } from "@/lib/db";
import { getBillingSubscription, listProjectsForUser } from "@/lib/repos";
import { CreateProjectForm } from "./create-project-form";
import styles from "./page.module.scss";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }
  const db = getDb();
  const projects = listProjectsForUser(db, userId);
  const billingEnforced = isCashfreeBillingEnforced();
  const billing = getBillingSubscription(db, userId);
  const billingActive = billing ? isCashfreeSubscriptionStatusActive(billing.status) : false;

  return (
    <div className={styles.root}>
      <DashboardPageHeader
        eyebrow="Workspace"
        title="Projects"
        description={
          <p>
            Each project has a <code>companyId</code> used in the SDK. Create an API key on the project overview page.
          </p>
        }
      />

      {billingEnforced ? (
        <DashboardPanel title="Subscription (Cashfree)" lead="Active billing is required to generate API keys and view ingest events.">
          <div className={styles.billingBody}>
            <p className={styles.billingStatus}>
              Status:{" "}
              <span className={billingActive ? styles.billingOk : styles.billingWarn}>
                {billing?.status ?? "not started"}
              </span>
              {billing?.cf_subscription_id ? (
                <span className={styles.billingMeta}> · Cashfree id {billing.cf_subscription_id}</span>
              ) : null}
            </p>
            <p className={styles.billingWebhook}>
              Webhook URL:{" "}
              <code className={styles.inlineCode}>
                {(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")}/api/webhooks/cashfree
              </code>
            </p>
            {!billingActive ? <CashfreeSubscribeButton /> : null}
          </div>
        </DashboardPanel>
      ) : null}

      <CreateProjectForm />

      <DashboardPanel title="Your projects">
        {projects.length === 0 ? (
          <p className={styles.empty}>No projects yet. Create one above.</p>
        ) : (
          <ul className={styles.list}>
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/dashboard/${p.id}`} className={styles.projectLink}>
                  <span className={styles.projectName}>{p.name}</span>
                  <span className={styles.projectId}>{p.company_id}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DashboardPanel>
    </div>
  );
}
