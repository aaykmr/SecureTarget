import clsx from "clsx";
import { Link, useLocation } from "react-router-dom";
import {
  Activity01Icon,
  Analytics01Icon,
  Apple01Icon,
  Building03Icon,
  DashboardSquare01Icon,
  Folder01Icon,
  Link01Icon,
  Mail01Icon,
  Megaphone01Icon,
  SettingsIcon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@/components/huge-icon";
import { HugeIcon } from "@/components/huge-icon";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { useAuth } from "@/auth/AuthContext";
import styles from "./dashboard-sidebar.module.scss";

const RESERVED = new Set(["organizations", "users", "inquiries"]);
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
  const { isGlobalAdmin } = useAuth();
  const projectMatch = pathname.match(/^\/dashboard\/([^/]+)/);
  const segment = projectMatch?.[1];
  const projectId = segment && !RESERVED.has(segment) ? segment : undefined;

  const projectsActive = pathname === "/dashboard";
  const orgsActive = pathname.startsWith("/dashboard/organizations");
  const usersActive = pathname.startsWith("/dashboard/users");
  const inquiriesActive = pathname.startsWith("/dashboard/inquiries");
  const displayName = email.split("@")[0] || "Account";

  function navHref(navSegment: string): string {
    if (!projectId) return "/dashboard";
    return navSegment ? `/dashboard/${projectId}/${navSegment}` : `/dashboard/${projectId}`;
  }

  function isActive(navSegment: string): boolean {
    if (!projectId) return false;
    const href = navHref(navSegment);
    if (navSegment === "") {
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
        <OrganizationSwitcher />
      </div>

      <nav className={styles.nav} aria-label="Dashboard">
        <Link to="/dashboard" className={clsx(styles.navLink, projectsActive && styles.navLinkActive)}>
          <HugeIcon icon={Folder01Icon} size={18} className={styles.navIcon} />
          <span>Projects</span>
        </Link>
        <Link to="/dashboard/users" className={clsx(styles.navLink, usersActive && styles.navLinkActive)}>
          <HugeIcon icon={UserMultipleIcon} size={18} className={styles.navIcon} />
          <span>Users</span>
        </Link>
        {isGlobalAdmin ? (
          <>
            <Link
              to="/dashboard/organizations"
              className={clsx(styles.navLink, orgsActive && styles.navLinkActive)}
            >
              <HugeIcon icon={Building03Icon} size={18} className={styles.navIcon} />
              <span>Organizations</span>
            </Link>
            <Link
              to="/dashboard/inquiries"
              className={clsx(styles.navLink, inquiriesActive && styles.navLinkActive)}
            >
              <HugeIcon icon={Mail01Icon} size={18} className={styles.navIcon} />
              <span>Inquiries</span>
            </Link>
          </>
        ) : null}
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
