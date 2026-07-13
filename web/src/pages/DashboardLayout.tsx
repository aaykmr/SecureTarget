import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import styles from "./DashboardLayout.module.scss";

export function DashboardLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className={styles.loading}>Loading…</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className={styles.root}>
      <DashboardSidebar email={user.email} />
      <div className={styles.main}>
        <Outlet />
      </div>
    </div>
  );
}
