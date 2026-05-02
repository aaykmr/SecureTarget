"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./dashboard-sidebar.module.scss";

export function DashboardSidebar() {
  const pathname = usePathname() ?? "";
  const projectMatch = pathname.match(/^\/dashboard\/([^/]+)/);
  const projectId = projectMatch?.[1];

  const projectsActive = pathname === "/dashboard";
  const overviewActive =
    Boolean(projectId) && (pathname === `/dashboard/${projectId}` || pathname === `/dashboard/${projectId}/`);
  const eventsActive = Boolean(projectId) && pathname.startsWith(`/dashboard/${projectId}/events`);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brandBlock}>
        <Link href="/dashboard" className={styles.brandLink}>
          SecureTarget
        </Link>
        <p className={styles.tagline}>Dashboard</p>
      </div>
      <nav className={styles.nav}>
        <Link href="/dashboard" className={clsx(styles.navLink, projectsActive && styles.navLinkActive)}>
          Projects
        </Link>
        {projectId ? (
          <>
            <Link
              href={`/dashboard/${projectId}`}
              className={clsx(styles.navLink, overviewActive && styles.navLinkActive)}
            >
              Overview
            </Link>
            <Link
              href={`/dashboard/${projectId}/events`}
              className={clsx(styles.navLink, eventsActive && styles.navLinkActive)}
            >
              Events
            </Link>
          </>
        ) : null}
      </nav>
    </aside>
  );
}
