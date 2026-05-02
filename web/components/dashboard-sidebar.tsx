"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function navClass(active: boolean): string {
  return [
    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
  ].join(" ");
}

export function DashboardSidebar() {
  const pathname = usePathname() ?? "";
  const projectMatch = pathname.match(/^\/dashboard\/([^/]+)/);
  const projectId = projectMatch?.[1];

  const projectsActive = pathname === "/dashboard";
  const overviewActive =
    Boolean(projectId) && (pathname === `/dashboard/${projectId}` || pathname === `/dashboard/${projectId}/`);
  const eventsActive = Boolean(projectId) && pathname.startsWith(`/dashboard/${projectId}/events`);

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <Link href="/dashboard" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          SecureTarget
        </Link>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Dashboard</p>
      </div>
      <nav className="flex flex-col gap-0.5 p-3">
        <Link href="/dashboard" className={navClass(projectsActive)}>
          Projects
        </Link>
        {projectId ? (
          <>
            <Link href={`/dashboard/${projectId}`} className={navClass(overviewActive)}>
              Overview
            </Link>
            <Link href={`/dashboard/${projectId}/events`} className={navClass(eventsActive)}>
              Events
            </Link>
          </>
        ) : null}
      </nav>
    </aside>
  );
}
