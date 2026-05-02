import clsx from "clsx";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { getProjectForUser, listApiKeysForProject } from "@/lib/repos";
import { CreateApiKeyForm } from "./create-key-form";
import { IntegrationSnippets } from "./integration-snippets";
import { RevokeKeyForm } from "./revoke-key-form";
import styles from "./page.module.scss";

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

  return (
    <div className={styles.root}>
      <div>
        <Link href="/dashboard" className={styles.backLink}>
          ← Back to projects
        </Link>
        <h1 className={styles.title}>{project.name}</h1>
        <p className={styles.companyLine}>companyId: {project.company_id}</p>
        <p className={styles.eventsLinkWrap}>
          <Link href={`/dashboard/${project.id}/events`} className={styles.eventsLink}>
            View ingest events →
          </Link>
        </p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>API keys</h2>
        <p className={styles.sectionLead}>
          Use the key in the <code className={styles.inlineCode}>x-api-key</code> header. The ingest server maps it to this project&apos;s{" "}
          <code className={styles.inlineCode}>companyId</code>.
        </p>
        <div className={styles.formSlot}>
          <CreateApiKeyForm projectId={project.id} />
        </div>
        <ul className={styles.keyList}>
          {keys.length === 0 ? (
            <li className={styles.emptyKeys}>No keys yet.</li>
          ) : (
            keys.map((k) => (
              <li key={k.id} className={styles.keyRow}>
                <div className={styles.keyMeta}>
                  <span
                    className={clsx(
                      styles.keyPrefix,
                      k.revoked_at ? styles.keyPrefixRevoked : styles.keyPrefixActive,
                    )}
                  >
                    {k.key_prefix}…
                  </span>
                  <span
                    className={clsx(
                      styles.keySub,
                      k.revoked_at ? styles.keySubRevoked : styles.keySubActive,
                    )}
                  >
                    {k.revoked_at ? `Revoked ${k.revoked_at}` : `Created ${k.created_at}`}
                  </span>
                </div>
                {!k.revoked_at ? <RevokeKeyForm projectId={project.id} keyId={k.id} /> : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Integration</h2>
        <p className={styles.sectionLead}>
          Point the Web SDK at your ingest server. Set <code className={styles.inlineCode}>NEXT_PUBLIC_INGEST_URL</code> in this app to match where you run the backend.
        </p>
        <div className={styles.integrationSlot}>
          <IntegrationSnippets companyId={project.company_id} />
        </div>
      </section>
    </div>
  );
}
