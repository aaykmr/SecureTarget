import clsx from "clsx";
import { Link, Navigate, Outlet, useParams } from "react-router-dom";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { LINK_TYPE_NAV } from "@/lib/link-types";
import styles from "./LinksLayout.module.scss";

export function LinksLayout() {
  const { projectId, linkTypeSegment } = useParams<{ projectId: string; linkTypeSegment?: string }>();
  if (!projectId) return null;

  return (
    <div className={styles.root}>
      <DashboardPageHeader
        backHref={`/dashboard/${projectId}`}
        backLabel="Project"
        eyebrow="Campaigns"
        title="Tracking links"
        description={<p>Create and measure CTA, VTA, One Link, and other link types for this project.</p>}
      />
      <nav className={styles.subnav} aria-label="Link types">
        {LINK_TYPE_NAV.map((item) => {
          const href = `/dashboard/${projectId}/links/${item.segment}`;
          const active = linkTypeSegment === item.segment;
          return (
            <Link key={item.type} to={href} className={clsx(styles.subnavLink, active && styles.subnavLinkActive)}>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}

export function LinksIndexRedirect() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <Navigate to={`/dashboard/${projectId}/links/one-link`} replace />;
}
