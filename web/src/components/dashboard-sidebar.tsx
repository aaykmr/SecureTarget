import clsx from "clsx";
import { Link, useLocation } from "react-router-dom";
import {
  Activity01Icon,
  Analytics01Icon,
  Apple01Icon,
  DashboardSquare01Icon,
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
import { ProjectSwitcher } from "@/components/project-switcher";
import { useAuth } from "@/auth/AuthContext";
import type { OrgTabKey } from "@/api/client";
import styles from "./dashboard-sidebar.module.scss";

const PROJECT_NAV: { segment: string; label: string; tab: OrgTabKey; icon: IconSvgElement }[] = [
  { segment: "", label: "Get started", tab: "get_started", icon: DashboardSquare01Icon },
  { segment: "campaigns", label: "Campaigns", tab: "campaigns", icon: Megaphone01Icon },
  { segment: "attribution", label: "Attribution", tab: "attribution", icon: Analytics01Icon },
  { segment: "links", label: "Links", tab: "links", icon: Link01Icon },
  { segment: "events", label: "Events", tab: "events", icon: Activity01Icon },
  { segment: "settings/apps", label: "App settings", tab: "app_settings", icon: SettingsIcon },
  { segment: "skan", label: "SKAN", tab: "skan", icon: Apple01Icon },
];

export function DashboardSidebar({ email }: { email: string }) {
  const { pathname } = useLocation();
  const { isGlobalAdmin, can, currentProjectId } = useAuth();
  const usersActive = pathname.startsWith("/dashboard/users");
  const inquiriesActive = pathname.startsWith("/dashboard/inquiries");
  const displayName = email.split("@")[0] || "Account";

  function navHref(navSegment: string): string {
    if (!currentProjectId) return "/dashboard";
    return navSegment ? `/dashboard/${currentProjectId}/${navSegment}` : `/dashboard/${currentProjectId}`;
  }

  function isActive(navSegment: string): boolean {
    if (!currentProjectId) return false;
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
        <ProjectSwitcher />
      </div>

      <nav className={styles.nav} aria-label="Dashboard">
        {can("users") ? (
          <Link to="/dashboard/users" className={clsx(styles.navLink, usersActive && styles.navLinkActive)}>
            <HugeIcon icon={UserMultipleIcon} size={18} className={styles.navIcon} />
            <span>Users</span>
          </Link>
        ) : null}
        {isGlobalAdmin ? (
          <Link
            to="/dashboard/inquiries"
            className={clsx(styles.navLink, inquiriesActive && styles.navLinkActive)}
          >
            <HugeIcon icon={Mail01Icon} size={18} className={styles.navIcon} />
            <span>Inquiries</span>
          </Link>
        ) : null}
        {PROJECT_NAV.filter((item) => can(item.tab)).map((item) => (
          <Link
            key={item.segment || "overview"}
            to={navHref(item.segment)}
            className={clsx(styles.navLink, isActive(item.segment) && styles.navLinkActive)}
            aria-disabled={!currentProjectId}
            onClick={(e) => {
              if (!currentProjectId) e.preventDefault();
            }}
          >
            <HugeIcon icon={item.icon} size={18} className={styles.navIcon} />
            <span>{item.label}</span>
          </Link>
        ))}
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
