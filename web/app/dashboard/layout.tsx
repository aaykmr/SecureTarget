import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import styles from "./layout.module.scss";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <DashboardSidebar />
      <div className={styles.mainColumn}>
        <header className={styles.header}>
          <ThemeToggle />
          <SignOutButton />
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
