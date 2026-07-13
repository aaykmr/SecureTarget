import clsx from "clsx";
import { Link, useLocation } from "react-router-dom";
import {
  Activity01Icon,
  Analytics01Icon,
  Apple01Icon,
  DashboardSquare01Icon,
  Folder01Icon,
  Link01Icon,
  Megaphone01Icon,
  SettingsIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@/components/huge-icon";
import { HugeIcon } from "@/components/huge-icon";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import styles from "./dashboard-sidebar.module.scss";

const PROJECT_NAV: { segment: string; label: string; icon: IconSvgElement }[] = [
  { segment: "", label: "Get started", icon: DashboardSquare01Icon },
  { segment: "campaigns", label: "Campaigns", icon: Megaphone01Icon },
  { segment: "attribution", label: "Attribution", icon: Analytics01Icon },
  { segment: "links", label: "Links", icon: Link01Icon },
  { segment: "events", label: "Events", icon: Activity01Icon },
  { segment: "settings/apps", label: "App settings", icon: SettingsIcon },
  { segment: "skan", label: "SKAN", icon: Apple01Icon },
];

export function DashboardSidebar({ email }: { email: string }) {
  const { pathname } = useLocation();
  const projectMatch = pathname.match(/^\/dashboard\/([^/]+)/);
  const projectId = projectMatch?.[1];

  const projectsActive = pathname === "/dashboard";
  const displayName = email.split("@")[0] || "Account";

  function navHref(segment: string): string {
    if (!projectId) return "/dashboard";
    return segment ? `/dashboard/${projectId}/${segment}` : `/dashboard/${projectId}`;
  }

  function isActive(segment: string): boolean {
    if (!projectId) return false;
    const href = navHref(segment);
    if (segment === "") {
      return pathname === href || pathname === `${href}/`;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brandBlock}>
        <Link to="/dashboard" className={styles.brandLink}>
          <HugeIcon icon={Analytics01Icon} size={20} className={styles.brandIcon} />
          <span className={styles.brandText}>EventIQN</span>
        </Link>
        <p className={styles.tagline}>Dashboard</p>
      </div>

      <nav className={styles.nav} aria-label="Dashboard">
        <Link to="/dashboard" className={clsx(styles.navLink, projectsActive && styles.navLinkActive)}>
          <HugeIcon icon={Folder01Icon} size={18} className={styles.navIcon} />
          <span>Projects</span>
        </Link>
        {projectId
          ? PROJECT_NAV.map((item) => (
              <Link
                key={item.segment || "overview"}
                to={navHref(item.segment)}
                className={clsx(styles.navLink, isActive(item.segment) && styles.navLinkActive)}
              >
                <HugeIcon icon={item.icon} size={18} className={styles.navIcon} />
                <span>{item.label}</span>
              </Link>
            ))
          : null}
      </nav>

      <div className={styles.footer}>
        <div className={styles.profile}>
          <span className={styles.profileName}>{displayName}</span>
          <span className={styles.profileEmail}>{email}</span>
        </div>
        <div className={styles.footerActions}>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}
