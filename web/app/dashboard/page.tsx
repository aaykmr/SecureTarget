import { isCashfreeBillingEnforced, isCashfreeSubscriptionStatusActive } from "@securetarget/shared";
import Link from "next/link";
import { auth } from "@/auth";
import { CashfreeSubscribeButton } from "@/components/cashfree-subscribe-button";
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
      {billingEnforced ? (
        <section className={styles.billingPanel} aria-label="Subscription">
          <h2 className={styles.billingTitle}>Subscription (Cashfree)</h2>
          <p className={styles.billingLead}>
            Sandbox billing is enforced while <code className={styles.inlineCode}>CASHFREE_CLIENT_ID</code> and{" "}
            <code className={styles.inlineCode}>CASHFREE_CLIENT_SECRET</code> are set. You need an{" "}
            <strong>active</strong> subscription to generate API keys and view ingest events. Failed renewals revoke keys
            and block events until payment succeeds again.
          </p>
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
            Webhook URL (configure in Cashfree dashboard):{" "}
            <code className={styles.inlineCode}>
              {(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")}/api/webhooks/cashfree
            </code>
          </p>
          {!billingActive ? <CashfreeSubscribeButton /> : null}
        </section>
      ) : null}
      <div>
        <h1 className={styles.blockTitle}>Projects</h1>
        <p className={styles.blockLead}>
          Each project has a <code className={styles.inlineCode}>companyId</code> used in the SDK. Create an API key on the project page.
        </p>
      </div>
      <CreateProjectForm />
      <div>
        <h2 className={styles.sectionTitle}>Your projects</h2>
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
      </div>
    </div>
  );
}
