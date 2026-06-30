import { DashboardSidebar } from "@/components/dashboard-sidebar";
import styles from "./layout.module.scss";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <DashboardSidebar />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
