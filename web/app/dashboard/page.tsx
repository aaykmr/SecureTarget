import Link from "next/link";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { listProjectsForUser } from "@/lib/repos";
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

  return (
    <div className={styles.root}>
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
